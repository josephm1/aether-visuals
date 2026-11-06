import fs from "node:fs/promises";
const root = new URL("../", import.meta.url);
export async function example(kind, figure = "dial") {
  if (kind === "interactive")
    return {
      kind,
      title: "Force lab",
      html: await fs.readFile(
        new URL("examples/interactive.html", root),
        "utf8",
      ),
    };
  if (kind !== "anatomy") throw Error("Unknown example kind.");
  if (figure === "engine") {
    let html = await fs.readFile(
      new URL(
        "vendor/anatomy/examples/raptor-engine/raptor-engine-light.html",
        root,
      ),
      "utf8",
    );
    if (!html.includes("touring = !still.matches"))
      throw Error("Review the upstream engine tour before adapting it.");
    html = html.replaceAll("touring = !still.matches", "touring = false");
    // The upstream PDF is not included in this offline example.
    html = html.replace(/<a class="iso-plate-pdf"[\s\S]*?<\/a>/, "");
    const controls =
      '<style>#engine-reset{min-height:44px;padding:12px 18px;border:1px solid #78958b;border-radius:8px;background:transparent;color:inherit;margin:12px}</style><button id="engine-reset">Stop and reset</button>';
    html = html
      .replace('<script type="module">', controls + '<script type="module">')
      .replace(
        /<\/script><\/body><\/html>\s*$/,
        `document.getElementById('engine-reset').onclick=()=>{touring=false;clearTimeout(idleTimer);if(burn.on)shutdown();select(null);setApart(false);for(const id of IDS){Object.assign(piece[id],{x:0,v:0,target:0,pending:null});}place();say(idleText());run();};</script></body></html>`,
      );
    return { kind, title: "Anatomy · rocket engine", html };
  }
  if (figure !== "dial") throw Error("Choose dial or engine.");

  let html = await fs.readFile(
    new URL(
      "vendor/anatomy/examples/dial-indicator/dial-indicator-light.html",
      root,
    ),
    "utf8",
  );
  if (
    !html.includes("touring = true") ||
    !html.includes("Hover to slide the carriage")
  )
    throw Error("Review the upstream dial example before adapting it.");
  html = html
    .replace("touring = true", "touring = false")
    .replace("touring = !still.matches", "touring = false")
    .replace(
      "Hover to slide the carriage",
      "Drag the carriage or choose a block",
    );
  const controls = `<style>.aether-dial-controls{display:flex;gap:8px;flex-wrap:wrap;padding:12px}.aether-dial-controls button{min-height:44px;padding:10px 14px;border:1px solid #78958b;border-radius:8px;background:transparent;color:inherit}.iso-stage{touch-action:pan-y}</style><div class="aether-dial-controls"><button data-block="0">Block 1 · 18</button><button data-block="1">Block 2 · 14</button><button data-block="2">Block 3 · 10</button><button id="dial-play" aria-pressed="false">Play</button><button id="dial-reset">Reset</button></div><script>
for(const button of document.querySelectorAll('[data-block]'))button.onclick=()=>steer(stops[Number(button.dataset.block)]);
const play=document.getElementById('dial-play');play.onclick=()=>{touring=!touring;clearTimeout(idleTimer);play.textContent=touring?'Pause':'Play';play.setAttribute('aria-pressed',String(touring));run();};
document.getElementById('dial-reset').onclick=()=>{steer(stops[0]);play.textContent='Play';play.setAttribute('aria-pressed','false');};
stage.addEventListener('pointerdown',event=>{stage.setPointerCapture(event.pointerId);stage.dispatchEvent(new PointerEvent('pointermove',{clientX:event.clientX,clientY:event.clientY}));});
</script>`;
  return {
    kind,
    title: "Anatomy · dial indicator",
    html: html
      .replace(
        '<script type="module">',
        controls.slice(0, controls.indexOf("<script>")) +
          '<script type="module">',
      )
      .replace(
        /<\/script><\/body><\/html>\s*$/,
        controls
          .slice(controls.indexOf("<script>") + 8)
          .replace("</script>", "") + "</script></body></html>",
      ),
  };
}
