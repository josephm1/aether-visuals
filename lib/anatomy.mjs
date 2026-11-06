import fs from "node:fs/promises";
// Inject the pinned, browser-safe upstream module only for an Anatomy artifact.
// This avoids asking the model to copy toolkit code or access another runtime's paths.
// A fitted figure owns its full geometry, including negative projected coordinates.
// Restrict this to toolkit figures; arbitrary charts can intentionally crop a viewport.
function containFigures() {
  const authored = new WeakMap();
  let pending = false;
  const fit = () => {
    pending = false;
    document.querySelectorAll("svg.iso-svg").forEach(svg => {
      if (svg.ownerSVGElement) return;
      const box = svg.getBBox();
      if (!box.width || !box.height) return;
      if (!authored.has(svg)) {
        const v = svg.viewBox.baseVal;
        authored.set(svg, {x:v.x, y:v.y, width:v.width, height:v.height});
      }
      const original = authored.get(svg), pad = 12;
      const left = Math.min(original.x, box.x - pad);
      const top = Math.min(original.y, box.y - pad);
      const right = Math.max(original.x + original.width, box.x + box.width + pad);
      const bottom = Math.max(original.y + original.height, box.y + box.height + pad);
      const bounds = [left, top, right-left, bottom-top].join(" ");
      if (svg.getAttribute("viewBox") !== bounds) svg.setAttribute("viewBox", bounds);
    });
  };
  const schedule = () => { if (!pending) { pending = true; requestAnimationFrame(fit); } };
  new MutationObserver(schedule).observe(document, {
    subtree:true, childList:true, attributes:true,
    attributeFilter:["d", "transform", "viewBox", "x", "y", "width", "height", "r", "cx", "cy"]
  });
  schedule();
}
export async function withAnatomyToolkit(html) {
  const source = await fs.readFile(
    new URL("../vendor/anatomy/kit/iso-kit.mjs", import.meta.url),
    "utf8",
  );
  const names = [
    ...source.matchAll(/^export (?:const|function|class) (\w+)/gm),
  ].map((m) => m[1]);
  if (!names.includes("solidSvg") || /^import\s/m.test(source))
    throw Error(
      "Review the pinned Anatomy browser module before upgrading it.",
    );
  const body = source
    .replace(/^export\s+/gm, "")
    .replace(/<\/script/gi, "<\\/script");
  return `<script>(()=>{${body}\nwindow.anatomy=Object.freeze({${names.join(",")}});const style=document.createElement('style');style.textContent=window.anatomy.ISO_CSS+'\\n.iso-svg{overflow:hidden}';document.head.append(style);(${containFigures.toString()})();})();</script>${html}`;
}
