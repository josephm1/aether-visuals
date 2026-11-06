import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash, randomUUID } from "node:crypto";
export const MAX_DOCUMENT = 2 * 1024 * 1024;
export const artifactRoot = () =>
  process.env.AETHER_VISUALS_DATA ||
  path.join(os.homedir(), ".aether", "visuals");
const hash = (data) => createHash("sha256").update(data).digest("hex");
const validId = (id) => {
  if (typeof id !== "string" || !/^[a-f0-9-]{36}$/.test(id))
    throw Error("Invalid visual ID.");
  return id;
};
export function titleText(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 120)
    throw Error("Use a title of 1–120 characters.");
  return value.trim();
}
export async function readSource(file, cwd) {
  if (typeof file !== "string" || !file.trim())
    throw Error("Write a self-contained HTML file first.");
  const source = await fs.realpath(path.resolve(cwd, file));
  const root = await fs.realpath(cwd);
  if (source !== root && !source.startsWith(root + path.sep))
    throw Error("The visual must be inside the current workspace.");
  const stat = await fs.stat(source);
  if (!stat.isFile() || stat.size > MAX_DOCUMENT)
    throw Error("Visual HTML limit is 2 MiB.");
  const bytes = await fs.readFile(source);
  if (!bytes.length || bytes.length > MAX_DOCUMENT)
    throw Error("Choose a nonempty HTML document up to 2 MiB.");
  return bytes.toString("utf8");
}
export async function saveArtifact(
  { html, title, kind = "interactive" },
  root = artifactRoot(),
) {
  title = titleText(title);
  if (!["interactive", "anatomy"].includes(kind))
    throw Error("Unknown visual kind.");
  const bytes = Buffer.from(html);
  if (!bytes.length || bytes.length > MAX_DOCUMENT)
    throw Error("Visual HTML limit is 2 MiB.");
  await fs.mkdir(root, { recursive: true, mode: 0o700 });
  const id = randomUUID(),
    record = {
      id,
      title,
      kind,
      created: new Date().toISOString(),
      sha256: hash(bytes),
      bytes: bytes.length,
    };
  // Each artifact is immutable and independently committed; no shared mutable index.
  await fs.writeFile(path.join(root, id + ".html"), bytes, {
    flag: "wx",
    mode: 0o600,
  });
  await fs.writeFile(path.join(root, id + ".json"), JSON.stringify(record), {
    flag: "wx",
    mode: 0o600,
  });
  return record;
}
export async function readArtifact(id, root = artifactRoot()) {
  validId(id);
  const metadata = await fs.readFile(path.join(root, id + ".json"), "utf8");
  if (metadata.length > 2048) throw Error("Invalid visual metadata.");
  const record = JSON.parse(metadata);
  if (record.id !== id) throw Error("Visual identity mismatch.");
  titleText(record.title);
  const stat = await fs.stat(path.join(root, id + ".html"));
  if (stat.size > MAX_DOCUMENT) throw Error("Visual is oversized.");
  const bytes = await fs.readFile(path.join(root, id + ".html"));
  if (bytes.length !== record.bytes || hash(bytes) !== record.sha256)
    throw Error("Visual content changed. Show the edited file again.");
  return { ...record, html: bytes.toString("utf8") };
}
export async function listArtifacts(root = artifactRoot()) {
  let files;
  try {
    files = await fs.readdir(root);
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
  const rows = [];
  for (const file of files) {
    if (!/^[a-f0-9-]{36}\.json$/.test(file)) continue;
    try {
      const a = await readArtifact(file.slice(0, -5), root);
      const { html, ...metadata } = a;
      rows.push(metadata);
    } catch {
      /* Incomplete/changed artifacts are not rendered. */
    }
  }
  return rows.sort((a, b) => b.created.localeCompare(a.created)).slice(0, 20);
}
