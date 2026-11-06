import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn, execFileSync } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { saveArtifact } from "../lib/artifacts.mjs";
import { example } from "./examples.mjs";
const bridge = process.env.AETHER_EXTENSION_BRIDGE;
if (!bridge)
  throw Error("Set AETHER_EXTENSION_BRIDGE to the built extension-bridge.mjs.");
test("real Aether host loads both standalone packages and renders their distinct messages", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "visuals-host-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const { version } = JSON.parse(await fs.readFile(new URL("../package.json", import.meta.url), "utf8"));
  const data = path.join(root, "visuals");
  const artifact = await saveArtifact(
    await example("anatomy", "engine"),
    path.join(data, "anatomy"),
  );
  const uiArtifact = await saveArtifact(
    await example("interactive"),
    path.join(data, "interactive-ui"),
  );
  const dir = path.join(root, ".aether/extensions");
  await fs.mkdir(dir, { recursive: true });
  for (const name of ["interactive-ui", "anatomy"])
    execFileSync("python3", [
      "-c",
      "import zipfile,sys;zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])",
      fileURLToPath(
        new URL("../dist/aether-" + name + "-" + version + ".zip", import.meta.url),
      ),
      path.join(dir, "aether-" + name),
    ]);
  const child = spawn(process.execPath, [bridge], {
    env: {
      ...process.env,
      HOME: root,
      USERPROFILE: root,
      AETHER_EXTENSIONS_DATA: data,
    },
    stdio: ["pipe", "pipe", "pipe"],
    cwd: root,
  });
  t.after(() => child.kill());
  const pending = new Map();
  let stderr = "";
  child.stderr.on("data", (b) => (stderr += b));
  createInterface({ input: child.stdout }).on("line", (line) => {
    const frame = JSON.parse(line);
    if (frame.id && pending.has(frame.id)) {
      const { resolve, reject, timer } = pending.get(frame.id);
      clearTimeout(timer);
      pending.delete(frame.id);
      frame.ok === false || frame.type === "error"
        ? reject(Error(JSON.stringify(frame.error)))
        : resolve(frame.payload);
    }
  });
  const call = (type, payload = {}) =>
    new Promise((resolve, reject) => {
      const id = String(Math.random()),
        timer = setTimeout(
          () => reject(Error("Bridge timeout: " + stderr)),
          20000,
        );
      pending.set(id, { resolve, reject, timer });
      child.stdin.write(JSON.stringify({ id, type, payload }) + "\n");
    });
  const loaded = await call("reload_aether_extensions", { context: {} });
  assert.equal(
    loaded.snapshot.extensions.length,
    2,
    JSON.stringify(loaded.errors) + stderr,
  );
  assert.equal(
    loaded.snapshot.surfaces[0].tree,
    null,
    "no overlay rendered during activation",
  );
  const extension_id = loaded.snapshot.extensions.find((x) =>
      x.name.includes("anatomy"),
    ).id,
    menu = loaded.snapshot.composer_menu_items.find(
      (x) => x.title === "Anatomy",
    );
  assert(menu);
  const opened = await call("invoke_aether_extension_action", {
    extension_id,
    action: menu.action,
    args: {},
    context: {},
  });
  const nodes = (tree) =>
    !tree
      ? []
      : Array.isArray(tree)
        ? tree.flatMap(nodes)
        : [tree, ...nodes(tree.children)];
  const button = nodes(opened.snapshot.surfaces.find((s) => s.tree)?.tree).find(
    (n) => n.type === "button" && n.label === artifact.title,
  );
  assert(button);
  const shown = await call("get_aether_extensions", {
    context: {
      custom_messages: [
        {
          id: "inline-test",
          type: "aether-anatomy",
          payload: { id: artifact.id },
        },
        {
          id: "ui-test",
          type: "aether-interactive-ui",
          payload: { id: uiArtifact.id },
        },
      ],
    },
  });
  const snapshot = shown.snapshot;
  assert.equal(snapshot.custom_messages.length, 2);
  const web = nodes(
    snapshot.custom_messages.find((m) => m.id === "inline-test").tree,
  ).find((n) => n.type === "web");
  assert(web.html.includes('sandbox="allow-scripts"'));
  assert(web.html.includes("Raptor"));
  assert(web.html.includes("window.anatomy=Object.freeze"));
  const uiWeb = nodes(
    snapshot.custom_messages.find((m) => m.id === "ui-test").tree,
  ).find((n) => n.type === "web");
  assert(!uiWeb.html.includes("window.anatomy=Object.freeze"));
  assert(Buffer.byteLength(JSON.stringify(shown)) < 4 * 1024 * 1024);
  assert.deepEqual(snapshot.event_names, [], "no lifecycle or prompt hooks");
});
