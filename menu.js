/*
 * Menu half of the Page PNG Export plugin (runs in the Modeler's Electron main process).
 * Asks for a folder, gets the PNGs from the client half, and writes them.
 * Works on macOS and Windows.
 */
'use strict';

var fs = require('fs');
var path = require('path');
var naming = require('./client/naming');

var SCALE = 2;                 // 2x the on-screen size
var WIN_PATH_LIMIT = 250;      // Windows MAX_PATH is 260; keep a margin
var lastFolder = null;

// The renderer is not trusted: names and data come from window.__pagePngExport, which any
// renderer code can replace, and names are derived from diagram content. Everything is
// re-checked here before it touches the file system.
// Same character set as naming.js BAD: path/Windows-reserved characters, C0/C1 controls,
// zero-width and bidi-override characters, BOM.
var UNSAFE_CHARS = /[\\/:*?"<>|\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/;
var PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
var MAX_BASE64_CHARS = 160 * 1024 * 1024;   // about 120 MB of PNG per page
var MAX_PAGES = 1000;

module.exports = function(electronApp, menuState) {
  return [{
    label: 'Export all pages as PNG…',
    enabled: function() { return true; },
    action: function() {
      run().catch(function(err) {
        require('electron').dialog.showErrorBox('Page PNG export failed', String((err && err.message) || err));
      });
    }
  }];
};

function revealLabel() {
  return process.platform === 'win32' ? 'Show in Explorer' : process.platform === 'darwin' ? 'Show in Finder' : 'Open folder';
}

async function run() {
  var electron = require('electron');
  var win = electron.BrowserWindow.getFocusedWindow() || electron.BrowserWindow.getAllWindows()[0];
  if (!win) throw new Error('No Camunda Modeler window found.');
  var wc = win.webContents;

  var loaded = await wc.executeJavaScript('typeof window.__pagePngExport === "object"', true);
  if (!loaded) throw new Error('The editor half of the plugin is not loaded. Restart Camunda Modeler and try again.');

  var info = await wc.executeJavaScript('window.__pagePngExport.info()', true);
  if (!info || !info.ok) {
    await electron.dialog.showMessageBox(win, { type: 'info', message: 'Nothing to export', detail: (info && info.message) || '' });
    return;
  }

  var pick = await electron.dialog.showOpenDialog(win, {
    title: 'Choose a folder for the PNG files',
    buttonLabel: 'Export here',
    defaultPath: lastFolder || info.folder || undefined,
    properties: ['openDirectory', 'createDirectory']
  });
  if (pick.canceled || !pick.filePaths || !pick.filePaths.length) return;
  var folder = pick.filePaths[0];
  lastFolder = folder;

  var result = await wc.executeJavaScript('window.__pagePngExport.exportAll(' + SCALE + ')', true);
  if (!result || !result.ok) throw new Error((result && result.message) || 'The editor did not return any pages.');
  if (!Array.isArray(result.pages) || result.pages.length > MAX_PAGES) throw new Error('The editor returned an invalid page list.');
  result.base = String(result.base || '');

  var shortened = 0;
  if (process.platform === 'win32') {
    var original = result.pages.map(function(p) { return p.name; });
    var fitted = naming.fitToPathLimit(folder, result.base, original, WIN_PATH_LIMIT);
    if (!fitted) throw new Error('The folder path is too long for Windows (limit about 260 characters). Choose a folder with a shorter path, for example C:\\BPMN.');
    fitted.forEach(function(n, i) { if (n !== original[i]) shortened++; result.pages[i].name = n; });
  }

  var outcome = writePages(folder, result.pages);

  var lines = [outcome.written + ' page' + (outcome.written === 1 ? '' : 's') + ' from "' + result.base + '"', 'Folder: ' + folder];
  var reduced = result.pages.filter(function(p) { return p.scale < SCALE - 1e-6; });
  if (reduced.length) lines.push(reduced.length + ' very large page(s) were exported below ' + SCALE + 'x to stay within image size limits.');
  if (shortened) lines.push(shortened + ' file name(s) were shortened to fit the Windows path length limit.');
  if (result.skipped && result.skipped.length) lines.push('Skipped (empty page): ' + result.skipped.join('; '));
  if (outcome.rejected.length) {
    lines.push('');
    lines.push(outcome.rejected.length + ' page(s) were refused because the file name or data was unsafe (it would have been written outside the chosen folder, or was not a PNG):');
    outcome.rejected.slice(0, 5).forEach(function(f) { lines.push('  ' + f.name + ' (' + f.reason + ')'); });
    if (outcome.rejected.length > 5) lines.push('  and ' + (outcome.rejected.length - 5) + ' more');
  }
  if (outcome.failed.length) {
    lines.push('');
    lines.push(outcome.failed.length + ' file(s) could not be written. A common cause is the PNG being open in another program, so close it and export again:');
    outcome.failed.slice(0, 5).forEach(function(f) { lines.push('  ' + f.name + ' (' + f.reason + ')'); });
    if (outcome.failed.length > 5) lines.push('  and ' + (outcome.failed.length - 5) + ' more');
  }

  var answer = await electron.dialog.showMessageBox(win, {
    type: (outcome.failed.length || outcome.rejected.length) ? 'warning' : 'info',
    message: (outcome.failed.length || outcome.rejected.length) ? 'Page PNG export finished with problems' : 'Page PNG export complete',
    detail: lines.join('\n'),
    buttons: ['OK', revealLabel()], defaultId: 0, cancelId: 0
  });
  if (answer.response === 1) electron.shell.openPath(folder);
}

/**
 * Resolve `name` inside `folder`. Returns the absolute target path, or null if the name
 * is not a plain "<something>.png" file name that lands directly in `folder`
 * (no separators, no "..", no drive letters or NTFS streams, no absolute paths).
 */
function safeTarget(folder, name) {
  if (typeof name !== 'string' || !name || name.length > 255) return null;
  if (UNSAFE_CHARS.test(name) || !/\.png$/i.test(name)) return null;
  // must be a bare file name under every path flavour, not just the current platform's
  if (name !== path.basename(name) || name !== path.win32.basename(name) || name !== path.posix.basename(name)) return null;
  if (/^[.\s]|[.\s]$/.test(name.slice(0, -4))) return null;      // ".." and Windows trailing dot/space tricks
  if (/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(name)) return null;  // Windows device names
  var root = path.resolve(folder);
  var target = path.resolve(root, name);
  if (path.dirname(target) !== root) return null;               // must sit directly in the chosen folder
  var rel = path.relative(root, target);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return target;
}

function pngBytes(data) {
  if (typeof data !== 'string' || data.length < 12 || data.length > MAX_BASE64_CHARS) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return null;        // strict base64, no whitespace or junk
  var buf = Buffer.from(data, 'base64');
  if (buf.length < PNG_MAGIC.length || !buf.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) return null;
  return buf;
}

// Refuse to write through an existing symlink or onto anything that is not a regular file.
function existingTargetProblem(target) {
  try {
    var st = fs.lstatSync(target);
    if (st.isSymbolicLink()) return 'existing file is a symbolic link';
    if (!st.isFile()) return 'existing entry is not a regular file';
    return null;
  } catch (e) {
    return e && e.code === 'ENOENT' ? null : (e.code || e.message);
  }
}

// O_NOFOLLOW closes the gap between the lstat check and the write on macOS/Linux;
// it does not exist on Windows, where the lstat check is what we have.
var WRITE_FLAGS = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC | (fs.constants.O_NOFOLLOW || 0);

function writePages(folder, pages) {
  var written = 0, failed = [], rejected = [];
  if (!Array.isArray(pages)) return { written: 0, failed: [], rejected: [{ name: '(all)', reason: 'invalid data from the editor' }] };
  if (pages.length > MAX_PAGES) return { written: 0, failed: [], rejected: [{ name: '(all)', reason: 'too many pages (' + pages.length + ')' }] };
  pages.forEach(function(p) {
    var name = p && p.name;
    var label = String(name).slice(0, 120);
    var target = safeTarget(folder, name);
    if (!target) { rejected.push({ name: label, reason: 'unsafe file name' }); return; }
    var buf = pngBytes(p.data);
    if (!buf) { rejected.push({ name: label, reason: 'not PNG data' }); return; }
    var problem = existingTargetProblem(target);
    if (problem) { rejected.push({ name: label, reason: problem }); return; }
    try {
      fs.writeFileSync(target, buf, { flag: WRITE_FLAGS, mode: 0o644 });
      written++;
    } catch (e) {
      failed.push({ name: label, reason: (e && (e.code === 'ELOOP' ? 'existing file is a symbolic link' : (e.code || e.message))) || 'unknown error' });
    }
  });
  return { written: written, failed: failed, rejected: rejected };
}

module.exports._run = run;             // for testing
module.exports._writePages = writePages;
module.exports._safeTarget = safeTarget;
