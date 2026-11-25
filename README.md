# Page PNG Export, a Camunda Modeler plugin (V0.4, macOS and Windows)

Exports every page of the open BPMN diagram (the main process and every collapsed
sub-process page, including nested ones) to PNG in one go, named so each image says
which drawing and which page it is.

Built for Camunda Modeler 5.53.0. The same folder works on macOS and Windows.

## Install on macOS

1. Quit Camunda Modeler.
2. In Finder press Shift-Cmd-G and go to `~/Library/Application Support`.
3. Make sure these folders exist, creating any that are missing, all lower case:
   `camunda-modeler` > `resources` > `plugins`
4. Copy the `page-png-export` folder into `plugins`, so you have
   `.../plugins/page-png-export/index.js`.
5. Start Camunda Modeler.

## Install on Windows

1. Unzip the download with right-click > Extract All. Don't copy from inside the zip window.
2. Quit Camunda Modeler.
3. Press Win+R, type `%APPDATA%` and press Enter. That opens `AppData\Roaming`.
4. Make sure these folders exist, creating any that are missing, all lower case:
   `camunda-modeler` > `resources` > `plugins`
5. Copy the `page-png-export` folder into `plugins`, so you have
   `...\AppData\Roaming\camunda-modeler\resources\plugins\page-png-export\index.js`.
6. Start Camunda Modeler.

(If you run Camunda Modeler from an unzipped folder, `resources\plugins` next to
`Camunda Modeler.exe` also works.)

If you are upgrading from an earlier version, delete the old `page-png-export` folder first, then copy the new one.

## Use

1. Open a BPMN diagram and make its tab the active one.
2. Choose **Plugins > Page PNG Export > Export all pages as PNG…**
3. Pick a folder. It opens on the drawing's own folder.
4. A message reports how many pages were written, with a button to show them in
   Finder (macOS) or Explorer (Windows).

Files are named:

    <drawing file name> - 00 Main process.png
    <drawing file name> - 07.0 Check if file name already received.png
    <drawing file name> - 11.0 Investigate... - 11.5 <nested page>.png

Step numbers are zero-padded so files sort in reading order. Characters that Windows,
SharePoint or Teams reject are replaced with a dash.

## Behaviour to know about

- Images are 2x the on-screen size, on a white background.
- Re-exporting to the same folder overwrites files with the same names.
- Files are only ever written directly into the folder you picked. A page whose file
  name, data or destination fails the checks below is refused and listed in the
  message; the other pages are still written.
- Empty sub-process pages are skipped and listed in the message.
- Very large pages are scaled down below 2x to stay within image size limits, and the message says so.
- Your view is put back on the page you were looking at.
- A file that cannot be written (for example a PNG still open in another program) is
  reported, and the rest are still written.
- Windows only: if the folder path plus file name would exceed about 250 characters,
  the drawing-name part of the file name is shortened and the message says so. If the
  folder path alone is too long, the export stops and asks you to choose a shorter one
  (OneDrive and SharePoint folders are the usual cause).

## If something goes wrong

- **No Plugins menu entry:** check `index.js` sits directly inside `plugins\page-png-export`, then restart.
- **"The editor half of the plugin is not loaded":** open Developer Tools (F12),
  look at the Console for red errors, and send the text.
- **Any other error:** the message box text, plus any red Console lines, is what's needed to fix it.

## Security notes

Camunda Modeler plugins run with your user's full permissions, so only install code you
trust. This one is small and readable: `menu.js` and `client/` are about 400 lines.

- It makes no network connections, starts no other programs, and reads no files.
- Its only file operation is writing `.png` files into the folder you choose.
- The only other thing it does outside the Modeler window is "Show in Finder / Explorer"
  on that same folder, when you press the button.
- Before writing, the main process re-checks everything the editor window hands over,
  because a diagram file or other code in that window could be hostile:
  - each name is a plain `.png` file name on both Windows and macOS rules: no folders,
    no `..`, no drive letters or `:` streams, no control, zero-width or bidi characters,
    no leading or trailing dot or space, no Windows device names (`CON`, `NUL`, `COM1`…);
  - the resolved path sits directly in the chosen folder;
  - the data is strict base64, at most about 120 MB, and starts with the PNG signature;
  - at most 1000 pages per export;
  - the destination is not an existing link or folder, and on macOS the file is opened
    with `O_NOFOLLOW` so a link swapped in at the last moment is not followed either.
  A file with the same name that already exists is overwritten.
- `dist/client.js` is built from `client/` with webpack and is not minified, so it can be
  read. It mirrors `client/` line for line; for V0.4 the edits were applied to both by hand rather than by re-running webpack. The only third-party
  code in it is `camunda-modeler-plugin-helpers` 5.1.0 (MIT, by the Camunda authors).

## Uninstall

Delete the `page-png-export` folder from `plugins` and restart the Modeler.

## Files

- `index.js`: plugin entry point
- `menu.js`: menu entry, folder dialog and file writing (Electron main process)
- `dist/client.js`: bundled editor-side code (built from `client/`)
- `client/index.js`, `client/naming.js`: source for the bundle
- `webpack.config.js`: how the bundle was built (`npx webpack`); not needed to run the plugin
