import fs from "node:fs/promises";
// Inject the pinned, browser-safe upstream module only for an Anatomy artifact.
// This avoids asking the model to copy toolkit code or access another runtime's paths.
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
  return `<script>(()=>{${body}\nwindow.anatomy=Object.freeze({${names.join(",")}});const style=document.createElement('style');style.textContent=window.anatomy.ISO_CSS;document.head.append(style);})();</script>${html}`;
}
