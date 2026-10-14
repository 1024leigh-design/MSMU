/* Shared drag and drop for the MicroLab bench scenes (stains.html, basics.html).
   Any SVG element with data-item="name" can be picked up. Drag it, or tap it once
   and then tap where it should go. The page decides what each drop means. */
window.MicroDrag = function(svg, o){
  let drag = null, raf = 0;
  const pt = e => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); };
  const redraw = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; o.draw(); }); };
  svg.addEventListener("pointerdown", e => {
    const p = pt(e);
    if (drag && drag.sticky){ drag.x = p.x; drag.y = p.y; const d = drag; drag = null; o.drop(d); o.draw(); return; }
    const g = e.target.closest("[data-item]"); if (!g || !svg.contains(g)) return;
    const item = g.dataset.item;
    if (o.canGrab && !o.canGrab(item)) return;
    e.preventDefault();
    drag = {item, x:p.x, y:p.y, sx:p.x, sy:p.y, moved:false, sticky:false};
    try { svg.setPointerCapture(e.pointerId); } catch (_) {}
    o.draw();
  });
  svg.addEventListener("pointermove", e => {
    if (!drag) return;
    const p = pt(e); drag.x = p.x; drag.y = p.y;
    if (Math.hypot(p.x - drag.sx, p.y - drag.sy) > 8) drag.moved = true;
    redraw();
  });
  svg.addEventListener("pointerup", () => {
    if (!drag || drag.sticky) return;
    if (!drag.moved){ drag.sticky = true; if (o.tapped) o.tapped(drag); o.draw(); return; }
    const d = drag; drag = null; o.drop(d); o.draw();
  });
  svg.addEventListener("pointercancel", () => { if (drag && !drag.sticky){ drag = null; o.draw(); } });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && drag){ drag = null; o.draw(); } });
  return {held:() => drag, cancel:() => { drag = null; }};
};
