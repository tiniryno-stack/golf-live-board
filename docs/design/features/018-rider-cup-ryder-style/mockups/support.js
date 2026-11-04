// Minimal stand-in for Claude Design's mockup runtime (support.js isn't in the handoff), enough to
// render docs/design/screens/*.html for side-by-side comparisons: {{expr}}, <sc-for>, <sc-if>, onClick.
(function () {
  class DCLogic { constructor(props) { this.props = props || {}; this.state = {}; }
    setState(o) { Object.assign(this.state, o); render(); } }
  window.DCLogic = DCLogic;
  let host, tpl, comp;
  const ev = (expr, scope) => { try { return new Function('s', 'with (s) { return (' + expr + '); }')(scope); } catch (e) { return undefined; } };
  const interp = (str, scope) => str.replace(/\{\{([^}]*)\}\}/g, (_, e) => { const v = ev(e, scope); return v == null ? '' : v; });
  function walk(node, scope) {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) { if (child.data.includes('{{')) child.data = interp(child.data, scope); continue; }
      if (child.nodeType !== 1) continue;
      const tag = child.tagName.toLowerCase();
      if (tag === 'sc-for') {
        const list = ev(child.getAttribute('list').replace(/^\{\{|\}\}$/g, ''), scope) || [];
        const as = child.getAttribute('as'); const frag = document.createDocumentFragment();
        list.forEach((item, i) => { const box = document.createElement('div'); box.innerHTML = child.innerHTML;
          walk(box, Object.assign(Object.create(scope), { [as]: item, index: i })); frag.append(...box.childNodes); });
        child.replaceWith(frag); continue;
      }
      if (tag === 'sc-if') {
        const v = ev(child.getAttribute('value').replace(/^\{\{|\}\}$/g, ''), scope);
        if (!v) { child.remove(); continue; }
        walk(child, scope); child.replaceWith(...child.childNodes); continue;
      }
      for (const a of [...child.attributes]) {
        if (!a.value.includes('{{')) continue;
        if (/^on/i.test(a.name)) { const fn = ev(a.value.replace(/^\{\{|\}\}$/g, ''), scope); child.removeAttribute(a.name);
          if (typeof fn === 'function') child.addEventListener(a.name.slice(2).toLowerCase(), fn); continue; }
        child.setAttribute(a.name, interp(a.value, scope));
      }
      walk(child, scope);
    }
  }
  function render() { const box = document.createElement('div'); box.innerHTML = tpl; walk(box, comp.renderVals());
    host.replaceChildren(...box.childNodes); }
  document.addEventListener('DOMContentLoaded', () => {
    host = document.querySelector('x-dc'); const s = document.querySelector('script[data-dc-script]'); if (!host || !s) return;
    tpl = host.innerHTML;
    const props = {}; const spec = JSON.parse(s.dataset.props || '{}');
    for (const [k, v] of Object.entries(spec)) if (!k.startsWith('$') && v && 'default' in v) props[k] = v.default;
    const q = new URLSearchParams(location.search); for (const [k, v] of q) props[k] = v;
    const Component = new Function('DCLogic', s.textContent + '; return Component;')(DCLogic);
    comp = new Component(props); render();
  });
})();
