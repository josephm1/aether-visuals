import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import puppeteer from "puppeteer-core";
import { viewerDocument } from "../lib/documents.mjs";
import { example } from "../lib/examples.mjs";
const executablePath = process.env.CHROME_PATH;
if (!executablePath)
  throw Error("Set CHROME_PATH to your local Chromium executable.");
async function setup(t, html, width = 390, touch = true) {
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
  await page.evaluateOnNewDocument(() => {});
  const network = [];
  page.on("response", (r) => {
    if (/^https?:/.test(r.url())) network.push(r.url());
  });
  await page.setContent(
    viewerDocument(
      { id: "00000000-0000-0000-0000-000000000000", html },
      "unguessable-test-action",
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
