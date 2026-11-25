/*
 * Client half of the Page PNG Export plugin (runs inside the Modeler window).
 * Tracks the bpmn-js editor of each tab, and exposes window.__pagePngExport, which the
 * menu half calls to render every page of the active diagram to PNG.
 */
import { registerClientExtension, registerBpmnJSPlugin } from 'camunda-modeler-plugin-helpers';
import { PureComponent } from 'camunda-modeler-plugin-helpers/react';

var naming = require('./naming');

var VERSION = '0.4.0';
var MAX_SIDE = 16000;          // Chromium canvas limits
var MAX_AREA = 64000000;

var state = { modelers: {}, activeTab: null, instances: [] };

// --- 1. track the active tab and the editor created for each tab -------------------------
class PagePngExportTracker extends PureComponent {
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
      var base = naming.baseName(f && f.name);
      var pages = [], skipped = [];
      try {
        for (var i = 0; i < roots.length; i++) {
          canvas.setRootElement(roots[i]);
          var res = await modeler.saveSVG();
          var segs = naming.pageSegments(roots[i].businessObject, isPage);
          var png = await api._svgToPng(res.svg, scale || 2);
          if (png) pages.push({ segments: segs, data: png.data, width: png.width, height: png.height, scale: png.scale });
          else skipped.push(segs.join(' - '));
        }
      } finally {
        canvas.setRootElement(original);
      }
      pages = naming.sortPages(pages);
      var names = naming.fileNames(base, pages);
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
