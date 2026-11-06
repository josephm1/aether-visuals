import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  artifactRoot,
  saveArtifact,
  readArtifact,
  listArtifacts,
} from "../lib/artifacts.mjs";
import {
  followupDraft,
  prepareDocument,
  viewerDocument,
} from "../lib/documents.mjs";
import { example } from "./examples.mjs";
import {
  activateAgent as activatePi,
  executeVisual,
  toolDefinition,
  createToolDefinition,
  compactVisualContext,
} from "../lib/agent.mjs";
import { INTERACTIVE_UI, ANATOMY } from "../lib/config.mjs";
import { activateAether } from "../lib/viewer.mjs";
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
  assert.equal(
    (await listArtifacts(root)).length,
    1,
    "listing is metadata-only; integrity is checked before rendering",
  );
  await assert.rejects(readArtifact("../private", root), /ID/);
});
test("HTML documents are bounded before being saved", async (t) => {
  const root = await temporary(t);
  await assert.rejects(
    saveArtifact(
      { html: "x".repeat(2 * 1024 * 1024 + 1), title: "Large" },
      root,
    ),
    /limit/,
  );
  await assert.rejects(
    executeVisual({ title: "Missing" }, { cwd: root }, root),
    /content/,
  );
});

test("tool show returns small metadata and no HTML or provider access", async (t) => {
  const root = await temporary(t);
  await fs.writeFile(
    path.join(root, "figure.html"),
    "<h1>Unique body secret</h1>",
  );
  const a = await executeVisual(
    { action: "render", content: "<h1>Unique body secret</h1>", title: "Test" },
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
    on() {},
    on: (...args) => hooks.push(args),
  });
  assert.equal(tools.length, 1);
  assert.deepEqual(
    hooks.map((h) => h[0]),
    ["context"],
  );
  assert.equal(tools[0].name, "render_ui");
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
test("inline rendering resizes locally and only drafts followups", async (t) => {
  const root = await temporary(t),
    actions = new Map(),
    events = new Map(),
    calls = [],
    appended = [];
  const a = await saveArtifact(
    { html: "<p>test</p>", title: "Test", sessionId: "chat-a" },
    root,
  );
  let surface, renderer;
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
    registerMessageType: (d) => (renderer = d.render),
    on: (n, f) => events.set(n, f),
    messages: { append: async (...args) => appended.push(args) },
    host: { invoke: async (...args) => calls.push(args) },
    invalidate() {},
  };
  const { actions: n } = await activateAether(api, { root });
  assert.equal(surface.render(), null);
  assert.deepEqual(calls, []);
  assert.equal(events.size, 0);
  let tree = await renderer({ message: { payload: { id: a.id } } });
  assert.equal(tree.args[0][1].args[0].height, 560);
  actions.get(n.resize)({ id: a.id, height: 1700 });
  tree = await renderer({ message: { payload: { id: a.id } } });
  assert.equal(tree.args[0][1].args[0].height, 1700);
  await actions.get(n.draft)({ id: a.id, text: "Explain", values: { x: 2 } });
  assert.deepEqual(
    calls.map((x) => x[0]),
    ["app.appendDraftInput"],
  );
  assert(!calls[0][1].text.includes("<p>test"));
  await actions.get(n.open)({});
  await actions.get(n.show)({ id: a.id });
  assert.equal(appended.length, 1);
  assert.equal(surface.render(), null);
});

test("Pi renderer emits a standard persisted custom message and compact details", async (t) => {
  const root = await temporary(t);
  const old = process.env.AETHER_EXTENSIONS_DATA;
  process.env.AETHER_EXTENSIONS_DATA = root;
  t.after(() => {
    if (old === undefined) delete process.env.AETHER_EXTENSIONS_DATA;
    else process.env.AETHER_EXTENSIONS_DATA = old;
  });
  let tool;
  const sent = [];
  activatePi({
    registerTool: (d) => (tool = d),
    registerCommand() {},
    on() {},
    sendMessage: (...args) => sent.push(args),
  });
  const result = await tool.execute(
    "call",
    { title: "Custom diagram", content: "<h1>Unique source body</h1>" },
    null,
    null,
    { cwd: root },
  );
  assert.equal(result.details.title, "Custom diagram");
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0], [
    {
      customType: "aether-interactive-ui",
      content: "Custom diagram",
      display: true,
      details: { id: result.details.id },
    },
    { triggerTurn: false },
  ]);
  const source = await tool.execute("read", { action: "read", id: result.details.id }, null, null, {});
  assert.equal(source.details.content, "<h1>Unique source body</h1>");
  assert.equal(sent.length, 1, "reading source must not append another display message");
  assert(!JSON.stringify(result).includes("Unique source body"));
  assert(!JSON.stringify(tool.parameters).includes("example"));
});

test("Anatomy assets load only for that artifact and stay outside model results", async (t) => {
  const root = await temporary(t);
  const result = await executeVisual(
    {
      title: "New mechanism",
      content: '<div class="iso" data-theme="light"><svg></svg></div>',
    },
    { cwd: root },
    root,
    ANATOMY,
  );
  const saved = await readArtifact(result.id, root);
  assert(!saved.html.includes("window.anatomy=Object.freeze"));
  assert(!JSON.stringify(result).includes("solidSvg"));
  assert(!toolDefinition.parameters.properties.file);
});

test("independent extensions register distinct tools, message types and storage", async (t) => {
  const root = await temporary(t),
    old = process.env.AETHER_EXTENSIONS_DATA;
  process.env.AETHER_EXTENSIONS_DATA = root;
  t.after(() => {
    if (old === undefined) delete process.env.AETHER_EXTENSIONS_DATA;
    else process.env.AETHER_EXTENSIONS_DATA = old;
  });
  const tools = [],
    sent = [];
  const pi = {
    registerTool: (d) => tools.push(d),
    registerCommand() {},
    on() {},
    sendMessage: (...args) => sent.push(args),
  };
  activatePi(pi, INTERACTIVE_UI);
  activatePi(pi, ANATOMY);
  assert.deepEqual(
    tools.map((t) => t.name),
    ["render_ui", "render_anatomy"],
  );
  for (const tool of tools)
    await tool.execute(
      "call",
      { title: tool.label, content: "<p>new</p>" },
      null,
      null,
      {},
    );
  assert.deepEqual(
    sent.map((s) => s[0].customType),
    ["aether-interactive-ui", "aether-anatomy"],
  );
  assert.notEqual(
    artifactRoot(INTERACTIVE_UI.namespace),
    artifactRoot(ANATOMY.namespace),
  );
  assert.equal(
    (await listArtifacts(artifactRoot(ANATOMY.namespace))).length,
    1,
  );
  assert(!createToolDefinition(INTERACTIVE_UI).parameters.properties.kind);
});

test("provider context omits visual source without mutating the persisted branch", async (t) => {
  const messages = [
    {
      role: "assistant",
      content: [
        {
          type: "toolCall",
          id: "call",
          name: "render_ui",
          arguments: { title: "Figure", content: "UNIQUE_HTML_SOURCE" },
        },
      ],
    },
    {
      role: "assistant",
      content: [
        {
          type: "toolCall",
          id: "other",
          name: "other_tool",
          arguments: { content: "keep" },
        },
      ],
    },
  ];
  const result = compactVisualContext(messages, "render_ui");
  assert(!JSON.stringify(result).includes("UNIQUE_HTML_SOURCE"));
  assert.equal(messages[0].content[0].arguments.content, "UNIQUE_HTML_SOURCE");
  assert.equal(result[1].content[0].arguments.content, "keep");
  const root = await temporary(t);
  const saved = await saveArtifact(
    { title: "Source", html: "a".repeat(7000) },
    root,
  );
  const first = await executeVisual({ action: "read", id: saved.id }, {}, root);
  assert.equal(first.content.length, 6000);
  assert.equal(first.nextOffset, 6000);
  const last = await executeVisual(
    { action: "read", id: saved.id, offset: first.nextOffset },
    {},
    root,
  );
  assert.equal(last.content.length, 1000);
  assert.equal(last.nextOffset, null);
});
