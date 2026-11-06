import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  artifactRoot,
  readSource,
  saveArtifact,
  readArtifact,
  listArtifacts,
} from "../lib/artifacts.mjs";
import {
  followupDraft,
  prepareDocument,
  viewerDocument,
} from "../lib/documents.mjs";
import { example } from "../lib/examples.mjs";
import activatePi, { executeVisual, toolDefinition } from "../agent.mjs";
import { activateAether } from "../aether.mjs";
async function temporary(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "aether-visuals-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}
test("snapshots are immutable and changed bytes never render", async (t) => {
  const root = await temporary(t);
  const a = await saveArtifact({ html: "<p>one</p>", title: "One" }, root);
  assert.equal((await readArtifact(a.id, root)).html, "<p>one</p>");
  assert.equal((await listArtifacts(root)).length, 1);
  await fs.writeFile(path.join(root, a.id + ".html"), "<p>two</p>");
  await assert.rejects(readArtifact(a.id, root), /changed/);
  assert.deepEqual(await listArtifacts(root), []);
  await assert.rejects(readArtifact("../private", root), /ID/);
});
test("source imports are bounded and cannot follow a link outside the workspace", async (t) => {
  const root = await temporary(t);
  await fs.mkdir(path.join(root, "workspace"));
  await fs.writeFile(path.join(root, "outside.html"), "private");
  await fs.symlink(
    path.join(root, "outside.html"),
    path.join(root, "workspace", "link.html"),
  );
  await assert.rejects(
    readSource("link.html", path.join(root, "workspace")),
    /workspace/,
  );
  await fs.writeFile(
    path.join(root, "large.html"),
    "x".repeat(2 * 1024 * 1024 + 1),
  );
  await assert.rejects(readSource("large.html", root), /limit/);
});
test("tool show returns small metadata and no HTML or provider access", async (t) => {
  const root = await temporary(t);
  await fs.writeFile(
    path.join(root, "figure.html"),
    "<h1>Unique body secret</h1>",
  );
  const a = await executeVisual(
    { action: "show", file: "figure.html", title: "Test" },
    { cwd: root },
    path.join(root, "store"),
  );
  assert(!JSON.stringify(a).includes("Unique body secret"));
  assert(JSON.stringify(a).length < 500);
  assert.equal((await listArtifacts(path.join(root, "store"))).length, 1);
});
test("guides are opt-in; activating does not add chat context or call a provider", () => {
  const hooks = [],
    tools = [];
  activatePi({
    registerTool: (t) => tools.push(t),
    registerCommand() {},
    on: (...args) => hooks.push(args),
  });
  assert.equal(tools.length, 1);
  assert.equal(hooks.length, 0);
  assert.equal(tools[0].name, "visual_artifact");
  assert(JSON.stringify(toolDefinition).length < 1200);
});
test("examples include real local model and accessible Anatomy controls", async () => {
  const a = await example("anatomy"),
    b = await example("interactive");
  assert(a.html.includes("touring = false"));
  assert(a.html.includes('data-block="2"'));
  assert(a.html.includes("pointerdown"));
  assert(b.html.includes("force=m*a"));
  assert(b.html.includes('id="reset"'));
});
test("followups send only selected scalar state and reject excessive context", () => {
  const draft = followupDraft({
    id: "id",
    title: "Force",
    text: "Why?",
    values: { mass: 2 },
  });
  assert(draft.includes('"mass":2'));
  assert(!draft.includes("<html"));
  assert.throws(
    () =>
      followupDraft({ text: "Why?", values: { nested: { html: "source" } } }),
    /scalar/,
  );
  assert.throws(() => followupDraft({ text: "x".repeat(1201) }), /1,200/);
  assert.throws(
    () => followupDraft({ text: "Why?", values: { source: "x".repeat(1025) } }),
    /1 KiB/,
  );
});
test("generated document is separate from native actions and receives no origin privileges", () => {
  const artifact = { id: "id", html: "<script>parent.stolen=true</script>" };
  const page = viewerDocument(artifact, "random-native-action");
  assert(page.includes('sandbox="allow-scripts"'));
  assert(!page.includes("allow-same-origin"));
  assert(
    prepareDocument(artifact.html).startsWith(
      '<meta http-equiv="Content-Security-Policy"',
    ),
  );
  assert(page.includes("event.source!==frame.contentWindow"));
  assert(page.includes("!event.isTrusted"));
});
test("Aether activation is lazy and native followup only creates a draft", async (t) => {
  const root = await temporary(t),
    actions = new Map(),
    calls = [];
  const a = await saveArtifact({ html: "<p>test</p>", title: "Test" }, root);
  let surface;
  const ui = new Proxy(
    {},
    {
      get:
        (_, type) =>
        (...args) => ({ type, args }),
    },
  );
  const api = {
    ui,
    registerAction: (n, f) => actions.set(n, f),
    registerComposerMenuItem() {},
    registerSurface: (_, s) => (surface = s),
    host: { invoke: async (...args) => calls.push(args) },
    invalidate() {},
  };
  const { actions: n } = await activateAether(api, { root });
  assert.equal(surface.render(), null);
  assert.deepEqual(calls, []);
  await actions.get(n.open)({});
  await actions.get(n.show)({ id: a.id });
  await actions.get(n.draft)({ id: a.id, text: "Explain", values: { x: 2 } });
  assert.deepEqual(
    calls.map((x) => x[0]),
    ["app.openScreen", "app.appendDraftInput"],
  );
  assert(calls[1][1].text.includes('"x":2'));
  assert(!calls[1][1].text.includes("<p>test"));
  assert.equal(surface.render(), null);
});
