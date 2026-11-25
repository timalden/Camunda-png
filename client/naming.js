/*
 * File naming for exported pages. Pure functions so they can be tested outside the Modeler.
 *
 *   <drawing file name> - 00 Main process.png
 *   <drawing file name> - 07.0 Check if file name already received.png
 *   <drawing file name> - 11.0 Investigate and resolve - 11.5 Some nested page.png
 */
'use strict';

var BAD = /[\\/:*?"<>|\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;

function clean(s) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
}

function sanitise(s) {
  return clean(String(s)
    .replace(/\s*[\\/|]\s*/g, '-')          // "status /onboard" -> "status-onboard"
    .replace(BAD, '-'))
    .replace(/^[.\s-]+|[.\s]+$/g, '');
}

function truncate(s, max) {
  return s.length <= max ? s : s.slice(0, max).replace(/[\s.-]+$/, '');
}

// "9.0 Classify File" -> "09.0 Classify File" so pages sort in reading order everywhere
function padNumber(name) {
  var m = /^(\d+)((?:\.\d+)*)(\s.*)?$/.exec(name);
  if (!m) return name;
  return (m[1].length < 2 ? '0' + m[1] : m[1]) + m[2] + (m[3] || '');
}

function isSubProcess(bo) {
  if (!bo) return false;
  if (typeof bo.$instanceOf === 'function') return bo.$instanceOf('bpmn:SubProcess');
  return /SubProcess$|Transaction$/.test(bo.$type || '');
}

function segment(bo) {
  var raw = clean(bo.name) || bo.id;
  // never fall back to the raw id: it is diagram content and may contain path separators
  return truncate(sanitise(padNumber(raw)), 80) || truncate(sanitise(bo.id), 80) || 'page';
}

/**
 * Name segments for one page. `bo` is the business object behind the page's root
 * (the collaboration or process for the main page, the sub-process for a drill-down page).
 * `isPage(bo)` says whether a sub-process has its own page, so expanded sub-processes,
 * which are drawn inline, are left out of the path.
 */
function pageSegments(bo, isPage) {
  if (!isSubProcess(bo)) return ['00 Main process'];
  var chain = [];
  for (var cur = bo; cur && isSubProcess(cur); cur = cur.$parent) {
    if (cur === bo || isPage(cur)) chain.unshift(cur);
  }
  return chain.map(segment);
}

function baseName(fileName) {
  var b = sanitise(clean(fileName || '').replace(/\.(bpmn|xml)$/i, ''));
  return b || 'diagram';
}

/** Turn pages ([{segments}]) into unique file names. */
function fileNames(base, pages) {
  var used = {};
  return pages.map(function(p) {
    var name = truncate(base + ' - ' + p.segments.join(' - '), 200).replace(BAD, '-');   // last line of defence
    var key = name.toLowerCase();
    used[key] = (used[key] || 0) + 1;
    if (used[key] > 1) name += ' (' + used[key] + ')';
    return name + '.png';
  });
}

/** Main page first, then by name, which follows the step numbering because of the padding. */
function sortPages(pages) {
  return pages.slice().sort(function(a, b) {
    var x = a.segments.join(' - '), y = b.segments.join(' - ');
    return x < y ? -1 : x > y ? 1 : 0;
  });
}


/**
 * Keep "<folder>\<file name>" within a path length limit (Windows MAX_PATH is 260).
 * Shortens the drawing's file name part first so the page name, which identifies the page,
 * stays readable. Returns null if the folder is too long for any usable name.
 */
function fitToPathLimit(folder, base, names, limit) {
  var room = limit - String(folder).length - 1;        // characters left for the file name
  var maxStem = room - 4;                              // minus ".png"
  if (maxStem < 40) return null;
  var out = [], used = {};
  names.forEach(function(name) {
    var stem = name.replace(/\.png$/i, '');
    if (stem.length > maxStem) {
      var sep = ' - ';
      var rest = stem.indexOf(base + sep) === 0 ? stem.slice(base.length + sep.length) : stem;
      var keepBase = maxStem - sep.length - rest.length;
      if (keepBase >= 15) stem = base.slice(0, keepBase).replace(/[\s.-]+$/, '') + sep + rest;
      else stem = (base.slice(0, 15).replace(/[\s.-]+$/, '') + sep + rest).slice(0, maxStem).replace(/[\s.-]+$/, '');
    }
    var candidate = stem, n = 1;
    while (used[candidate.toLowerCase()]) {
      n++;
      var suffix = ' (' + n + ')';
      candidate = stem.slice(0, maxStem - suffix.length).replace(/[\s.-]+$/, '') + suffix;
    }
    used[candidate.toLowerCase()] = true;
    out.push(candidate + '.png');
  });
  return out;
}

module.exports = {
  fitToPathLimit: fitToPathLimit,
  clean: clean, sanitise: sanitise, padNumber: padNumber, pageSegments: pageSegments,
  baseName: baseName, fileNames: fileNames, sortPages: sortPages, isSubProcess: isSubProcess
};
