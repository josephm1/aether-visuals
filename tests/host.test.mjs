import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { saveArtifact } from "../lib/artifacts.mjs";
import { example } from "../lib/examples.mjs";
const bridge = process.env.AETHER_EXTENSION_BRIDGE;
if (!bridge)
  throw Error("Set AETHER_EXTENSION_BRIDGE to the built extension-bridge.mjs.");
test("real Aether extension bridge loads, discovers and renders a saved Anatomy artifact", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "visuals-host-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const data = path.join(root, "visuals");
  const artifact = await saveArtifact(await example("anatomy", "engine"), data);
  const dir = path.join(root, ".aether/extensions");
  await fs.mkdir(dir, { recursive: true });
  await fs.cp(
    fileURLToPath(new URL("../", import.meta.url)),
    path.join(dir, "aether-visuals"),
    {
      recursive: true,
      filter: (file) =>
        !["node_modules", "verification", "dist", "tests"].some((part) =>
          file.split(path.sep).includes(part),
        ),
    },
  );
  const child = spawn(process.execPath, [bridge], {
    env: {
      ...process.env,
      HOME: root,
      USERPROFILE: root,
      AETHER_VISUALS_DATA: data,
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
    1,
    JSON.stringify(loaded.errors) + stderr,
  );
  assert.equal(
    loaded.snapshot.surfaces[0].tree,
    null,
    "no overlay rendered during activation",
  );
  const extension_id = loaded.snapshot.extensions[0].id,
    menu = loaded.snapshot.composer_menu_items.find(
      (x) => x.title === "Visuals",
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
  const button = nodes(opened.snapshot.surfaces[0].tree).find(
    (n) => n.type === "button" && n.label === artifact.title,
  );
  assert(button);
  const shown = await call("invoke_aether_extension_action", {
    extension_id,
    action: button.action,
    args: button.args,
    context: {},
  });
  const web = nodes(shown.snapshot.surfaces[0].tree).find(
    (n) => n.type === "web",
  );
  assert(web.html.includes('sandbox="allow-scripts"'));
  assert(web.html.includes("Raptor"));
  assert(Buffer.byteLength(JSON.stringify(shown)) < 4 * 1024 * 1024);
  assert.deepEqual(shown.snapshot.event_names, [], "no automatic prompt hook");
});
