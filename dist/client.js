/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 586
(module) {

if (!window.react) {
  throw new Error('Not compatible with Camunda Modeler < 3.4');
}

/**
 * React object used by Camunda Modeler. Use it to create UI extension.
 *
 * @type {import('react')}
 */
module.exports = window.react;

/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	const __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		const cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		const module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/concatenation wrap */
/******/ 	// wrap a concatenated module body as a lazy, memoized accessor; mod is
/******/ 	// set before the body runs so re-entrant calls (require cycles) observe
/******/ 	// the partial exports like Node.js
/******/ 	__webpack_require__.cw = (body) => {
/******/ 		var mod;
/******/ 		return () => {
/******/ 			if (body) {
/******/ 				var fn = body;
/******/ 				body = 0;
/******/ 				mod = { exports: {} };
/******/ 				fn.call(mod.exports, mod, mod.exports);
/******/ 			}
/******/ 			return mod.exports;
/******/ 		};
/******/ 	};
/******/ 	
/************************************************************************/
// This entry needs to be wrapped in an IIFE because it needs to be in strict mode.
(() => {
"use strict";

// MODULE: ./client/naming.js
var naming_namespaceFn = /*#__PURE__*/__webpack_require__.cw((module) => {
/*
 * File naming for exported pages. Pure functions so they can be tested outside the Modeler.
 *
 *   <drawing file name> - 00 Main process.png
 *   <drawing file name> - 07.0 Check if file name already received.png
 *   <drawing file name> - 11.0 Investigate and resolve - 11.5 Some nested page.png
 */


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

});

;// ../node_modules/camunda-modeler-plugin-helpers/index.js
/**
 * Validate and register a client plugin.
 *
 * @param {Object} plugin
 * @param {String} type
 */
function registerClientPlugin(plugin, type) {
  var plugins = window.plugins || [];
  window.plugins = plugins;

  if (!plugin) {
    throw new Error('plugin not specified');
  }

  if (!type) {
    throw new Error('type not specified');
  }

  plugins.push({
    plugin: plugin,
    type: type
  });
}

/**
 * Validate and register a client plugin.
 *
 * @param {import('react').ComponentType} extension
 *
 * @example
 *
 * import MyExtensionComponent from './MyExtensionComponent';
 *
 * registerClientExtension(MyExtensionComponent);
 */
function registerClientExtension(component) {
  registerClientPlugin(component, 'client');
}

/**
 * Validate and register a bpmn-js plugin.
 *
 * @param {Object} module
 *
 * @example
 *
 * import {
 *   registerBpmnJSPlugin
 * } from 'camunda-modeler-plugin-helpers';
 *
 * const BpmnJSModule = {
 *   __init__: [ 'myService' ],
 *   myService: [ 'type', ... ]
 * };
 *
 * registerBpmnJSPlugin(BpmnJSModule);
 */
function registerBpmnJSPlugin(module) {
  registerClientPlugin(module, 'bpmn.modeler.additionalModules');
}

/**
 * Validate and register a platform specific bpmn-js plugin.
 *
 * @param {Object} module
 *
 * @example
 *
 * import {
 *   registerPlatformBpmnJSPlugin
 * } from 'camunda-modeler-plugin-helpers';
 *
 * const BpmnJSModule = {
 *   __init__: [ 'myService' ],
 *   myService: [ 'type', ... ]
 * };
 *
 * registerPlatformBpmnJSPlugin(BpmnJSModule);
 */
function registerPlatformBpmnJSPlugin(module) {
  registerClientPlugin(module, 'bpmn.platform.modeler.additionalModules');
}

/**
 * Validate and register a cloud specific bpmn-js plugin.
 *
 * @param {Object} module
 *
 * @example
 *
 * import {
 *   registerCloudBpmnJSPlugin
 * } from 'camunda-modeler-plugin-helpers';
 *
 * const BpmnJSModule = {
 *   __init__: [ 'myService' ],
 *   myService: [ 'type', ... ]
 * };
 *
 * registerCloudBpmnJSPlugin(BpmnJSModule);
 */
function registerCloudBpmnJSPlugin(module) {
  registerClientPlugin(module, 'bpmn.cloud.modeler.additionalModules');
}

/**
 * Validate and register a bpmn-moddle extension plugin.
 *
 * @param {Object} descriptor
 *
 * @example
 * import {
 *   registerBpmnJSModdleExtension
 * } from 'camunda-modeler-plugin-helpers';
 *
 * var moddleDescriptor = {
 *   name: 'my descriptor',
 *   uri: 'http://example.my.company.localhost/schema/my-descriptor/1.0',
 *   prefix: 'mydesc',
 *
 *   ...
 * };
 *
 * registerBpmnJSModdleExtension(moddleDescriptor);
 */
function registerBpmnJSModdleExtension(descriptor) {
  registerClientPlugin(descriptor, 'bpmn.modeler.moddleExtension');
}

/**
 * Validate and register a platform specific bpmn-moddle extension plugin.
 *
 * @param {Object} descriptor
 *
 * @example
 * import {
 *   registerPlatformBpmnJSModdleExtension
 * } from 'camunda-modeler-plugin-helpers';
 *
 * var moddleDescriptor = {
 *   name: 'my descriptor',
 *   uri: 'http://example.my.company.localhost/schema/my-descriptor/1.0',
 *   prefix: 'mydesc',
 *
 *   ...
 * };
 *
 * registerPlatformBpmnJSModdleExtension(moddleDescriptor);
 */
function registerPlatformBpmnJSModdleExtension(descriptor) {
  registerClientPlugin(descriptor, 'bpmn.platform.modeler.moddleExtension');
}

/**
 * Validate and register a cloud specific bpmn-moddle extension plugin.
 *
 * @param {Object} descriptor
 *
 * @example
 * import {
 *   registerCloudBpmnJSModdleExtension
 * } from 'camunda-modeler-plugin-helpers';
 *
 * var moddleDescriptor = {
 *   name: 'my descriptor',
 *   uri: 'http://example.my.company.localhost/schema/my-descriptor/1.0',
 *   prefix: 'mydesc',
 *
 *   ...
 * };
 *
 * registerCloudBpmnJSModdleExtension(moddleDescriptor);
 */
function registerCloudBpmnJSModdleExtension(descriptor) {
  registerClientPlugin(descriptor, 'bpmn.cloud.modeler.moddleExtension');
}

/**
 * Validate and register a dmn-moddle extension plugin.
 *
 * @param {Object} descriptor
 *
 * @example
 * import {
 *   registerDmnJSModdleExtension
 * } from 'camunda-modeler-plugin-helpers';
 *
 * var moddleDescriptor = {
 *   name: 'my descriptor',
 *   uri: 'http://example.my.company.localhost/schema/my-descriptor/1.0',
 *   prefix: 'mydesc',
 *
 *   ...
 * };
 *
 * registerDmnJSModdleExtension(moddleDescriptor);
 */
function registerDmnJSModdleExtension(descriptor) {
  registerClientPlugin(descriptor, 'dmn.modeler.moddleExtension');
}

/**
 * Validate and register a cloud specific dmn-moddle extension plugin.
 *
 * @param {Object} descriptor
 *
 * @example
 * import {
 *   registerCloudDmnJSModdleExtension
 * } from 'camunda-modeler-plugin-helpers';
 *
 * var moddleDescriptor = {
 *   name: 'my descriptor',
 *   uri: 'http://example.my.company.localhost/schema/my-descriptor/1.0',
 *   prefix: 'mydesc',
 *
 *   ...
 * };
 *
 * registerCloudDmnJSModdleExtension(moddleDescriptor);
 */
function registerCloudDmnJSModdleExtension(descriptor) {
  registerClientPlugin(descriptor, 'dmn.cloud.modeler.moddleExtension');
}

/**
 * Validate and register a platform specific dmn-moddle extension plugin.
 *
 * @param {Object} descriptor
 *
 * @example
 * import {
 *   registerPlatformDmnJSModdleExtension
 * } from 'camunda-modeler-plugin-helpers';
 *
 * var moddleDescriptor = {
 *   name: 'my descriptor',
 *   uri: 'http://example.my.company.localhost/schema/my-descriptor/1.0',
 *   prefix: 'mydesc',
 *
 *   ...
 * };
 *
 * registerPlatformDmnJSModdleExtension(moddleDescriptor);
 */
function registerPlatformDmnJSModdleExtension(descriptor) {
  registerClientPlugin(descriptor, 'dmn.platform.modeler.moddleExtension');
}

/**
 * Validate and register a dmn-js plugin.
 *
 * @param {Object} module
 *
 * @example
 *
 * import {
 *   registerDmnJSPlugin
 * } from 'camunda-modeler-plugin-helpers';
 *
 * const DmnJSModule = {
 *   __init__: [ 'myService' ],
 *   myService: [ 'type', ... ]
 * };
 *
 * registerDmnJSPlugin(DmnJSModule, [ 'drd', 'literalExpression' ]);
 * registerDmnJSPlugin(DmnJSModule, 'drd')
 */
function registerDmnJSPlugin(module, components) {

  if (!Array.isArray(components)) {
    components = [ components ]
  }

  components.forEach(c => registerClientPlugin(module, `dmn.modeler.${c}.additionalModules`));
}

/**
 * Validate and register a cloud specific dmn-js plugin.
 *
 * @param {Object} module
 *
 * @example
 *
 * import {
 *   registerCloudDmnJSPlugin
 * } from 'camunda-modeler-plugin-helpers';
 *
 * const DmnJSModule = {
 *   __init__: [ 'myService' ],
 *   myService: [ 'type', ... ]
 * };
 *
 * registerCloudDmnJSPlugin(DmnJSModule, [ 'drd', 'literalExpression' ]);
 * registerCloudDmnJSPlugin(DmnJSModule, 'drd')
 */
function registerCloudDmnJSPlugin(module, components) {

  if (!Array.isArray(components)) {
    components = [ components ]
  }

  components.forEach(c => registerClientPlugin(module, `dmn.cloud.modeler.${c}.additionalModules`));
}

/**
 * Validate and register a platform specific dmn-js plugin.
 *
 * @param {Object} module
 *
 * @example
 *
 * import {
 *   registerPlatformDmnJSPlugin
 * } from 'camunda-modeler-plugin-helpers';
 *
 * const DmnJSModule = {
 *   __init__: [ 'myService' ],
 *   myService: [ 'type', ... ]
 * };
 *
 * registerPlatformDmnJSPlugin(DmnJSModule, [ 'drd', 'literalExpression' ]);
 * registerPlatformDmnJSPlugin(DmnJSModule, 'drd')
 */
function registerPlatformDmnJSPlugin(module, components) {

  if (!Array.isArray(components)) {
    components = [ components ]
  }

  components.forEach(c => registerClientPlugin(module, `dmn.platform.modeler.${c}.additionalModules`));
}

/**
 * Return the modeler directory, as a string.
 *
 * @deprecated Will be removed in future Camunda Modeler versions without replacement.
 *
 * @return {String}
 */
function getModelerDirectory() {
  return window.getModelerDirectory();
}

/**
 * Return the modeler plugin directory, as a string.
 *
 * @deprecated Will be removed in future Camunda Modeler versions without replacement.
 *
 * @return {String}
 */
function getPluginsDirectory() {
  return window.getPluginsDirectory();
}
// EXTERNAL MODULE: ../node_modules/camunda-modeler-plugin-helpers/react.js
var react = __webpack_require__(586);
;// ./client/index.js
/*
 * Client half of the Page PNG Export plugin (runs inside the Modeler window).
 * Tracks the bpmn-js editor of each tab, and exposes window.__pagePngExport, which the
 * menu half calls to render every page of the active diagram to PNG.
 */



var client_naming = (naming_namespaceFn());

var VERSION = '0.4.0';
var MAX_SIDE = 16000;          // Chromium canvas limits
var MAX_AREA = 64000000;

var state = { modelers: {}, activeTab: null, instances: [] };

// --- 1. track the active tab and the editor created for each tab -------------------------
class PagePngExportTracker extends react.PureComponent {
  constructor(props) {
    super(props);
    var subscribe = props.subscribe;
    subscribe('app.activeTabChanged', function(event) {
      state.activeTab = (event && event.activeTab) || null;
    });
    subscribe('bpmn.modeler.created', function(event) {
      if (event && event.tab && event.modeler) state.modelers[event.tab.id] = event.modeler;
    });
  }
  render() { return null; }
}
registerClientExtension(PagePngExportTracker);

// --- 2. fallback: every bpmn-js editor registers itself, so we can pick the visible one ---
function Registrar(bpmnjs, eventBus) {
  state.instances.push(bpmnjs);
  eventBus.on('diagram.destroy', function() {
    state.instances = state.instances.filter(function(i) { return i !== bpmnjs; });
  });
}
Registrar.$inject = ['bpmnjs', 'eventBus'];
registerBpmnJSPlugin({ __init__: ['pagePngExportRegistrar'], pagePngExportRegistrar: ['type', Registrar] });

function isVisible(modeler) {
  try {
    var c = modeler.get('canvas').getContainer();
    return !!c && document.body.contains(c) && c.offsetWidth > 0 && c.offsetHeight > 0;
  } catch (e) { return false; }
}

function activeModeler() {
  var t = state.activeTab;
  if (t && state.modelers[t.id] && isVisible(state.modelers[t.id])) return state.modelers[t.id];
  var visible = state.instances.filter(isVisible);
  return visible.length === 1 ? visible[0] : (t && state.modelers[t.id]) || visible[0] || null;
}

function dirName(p) {
  if (!p) return null;
  var i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  return i > 0 ? p.slice(0, i) : null;
}

// --- 3. SVG -> PNG (base64), white background ----------------------------------------------
function svgToPng(svg, scale) {
  return new Promise(function(resolve, reject) {
    var root = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
    var w = parseFloat(root.getAttribute('width')), h = parseFloat(root.getAttribute('height'));
    if (!(w >= 1 && h >= 1)) { resolve(null); return; }            // empty page
    var s = Math.min(scale, MAX_SIDE / w, MAX_SIDE / h, Math.sqrt(MAX_AREA / (w * h)));
    var img = new Image();
    img.onload = function() {
      try {
        var c = document.createElement('canvas');
        c.width = Math.ceil(w * s); c.height = Math.ceil(h * s);
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve({ data: c.toDataURL('image/png').split(',')[1], width: c.width, height: c.height, scale: s });
      } catch (e) { reject(e); }
    };
    img.onerror = function() { reject(new Error('Could not render a page to PNG')); };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

// --- 4. the API the menu half calls ----------------------------------------------------------
var api = {
  version: VERSION,
  _svgToPng: svgToPng,                        // replaceable in tests

  info: function() {
    var m = activeModeler();
    if (!m) return { ok: false, message: 'Open a BPMN diagram in the active tab, then try again.' };
    var f = state.activeTab && state.activeTab.file;
    return { ok: true, fileName: f && f.name || null, folder: dirName(f && f.path), version: VERSION };
  },

  exportAll: async function(scale) {
    try {
      var modeler = activeModeler();
      if (!modeler) return { ok: false, message: 'Open a BPMN diagram in the active tab, then try again.' };
      var canvas = modeler.get('canvas');
      var original = canvas.getRootElement();
      var roots = (typeof canvas.getRootElements === 'function' ? canvas.getRootElements() : [original])
        .filter(function(r) { return r && r.businessObject && !/^__implicitroot/.test(r.id); });
      var pageBos = roots.map(function(r) { return r.businessObject; });
      var isPage = function(bo) { return pageBos.indexOf(bo) !== -1; };
      var f = state.activeTab && state.activeTab.file;
      var base = client_naming.baseName(f && f.name);
      var pages = [], skipped = [];
      try {
        for (var i = 0; i < roots.length; i++) {
          canvas.setRootElement(roots[i]);
          var res = await modeler.saveSVG();
          var segs = client_naming.pageSegments(roots[i].businessObject, isPage);
          var png = await api._svgToPng(res.svg, scale || 2);
          if (png) pages.push({ segments: segs, data: png.data, width: png.width, height: png.height, scale: png.scale });
          else skipped.push(segs.join(' - '));
        }
      } finally {
        canvas.setRootElement(original);
      }
      pages = client_naming.sortPages(pages);
      var names = client_naming.fileNames(base, pages);
      return {
        ok: true, base: base, skipped: skipped,
        pages: pages.map(function(p, k) { return { name: names[k], data: p.data, width: p.width, height: p.height, scale: p.scale }; })
      };
    } catch (e) {
      return { ok: false, message: (e && e.message) || String(e) };
    }
  }
};

window.__pagePngExport = api;

})();

/******/ })()
;