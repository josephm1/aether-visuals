import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  artifactRoot,
  saveArtifact,
  readSource,
  listArtifacts,
} from "./lib/artifacts.mjs";
import { example } from "./lib/examples.mjs";
export const toolDefinition = {
  name: "visual_artifact",
  label: "Interactive visual",
  description:
    "On demand: guide for a rich interactive answer or Anatomy isometric figure; example to try one; show to snapshot a self-contained workspace HTML file. Local controls use no AI. Never load guides for ordinary answers. Returns IDs/metadata, not document source. Open Visuals in the composer menu to interact.",
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["guide", "example", "show", "list"] },
      kind: { type: "string", enum: ["interactive", "anatomy"] },
      example: { type: "string", enum: ["dial", "engine"] },
      file: { type: "string" },
      title: { type: "string" },
    },
    required: ["action"],
    additionalProperties: false,
  },
};
export async function executeVisual(args, context, root = artifactRoot()) {
  const kind = args.kind || "interactive";
  if (!["interactive", "anatomy"].includes(kind))
    throw Error("Unknown visual kind.");
  if (args.action === "guide")
    return {
      guide: await fs.readFile(
        new URL("./guides/" + kind + ".md", import.meta.url),
        "utf8",
      ),
      toolkit:
        kind === "anatomy"
          ? fileURLToPath(new URL("./vendor/anatomy/", import.meta.url))
          : undefined,
    };
  if (args.action === "list") return { visuals: await listArtifacts(root) };
  const input =
    args.action === "example"
      ? await example(kind, args.example)
      : args.action === "show"
        ? {
            kind,
            title: args.title,
            html: await readSource(args.file, context.cwd),
          }
        : null;
  if (!input) throw Error("Unknown visual action.");
  const record = await saveArtifact(input, root);
  return {
    ...record,
    next: "Open Visuals from Aether’s composer menu. Controls run locally; no provider call was made.",
  };
}
export default function visualsExtension(pi) {
  pi.registerTool({
    ...toolDefinition,
    execute: async (_call, args, _signal, _update, context) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(await executeVisual(args, context)),
        },
      ],
    }),
  });
  pi.registerCommand("visuals", {
    description: "Show interactive-visual creation guidance",
    handler: async (_args, context) =>
      context.ui.notify(
        "Use visual_artifact for interactive answers. Open Visuals from the composer menu to view saved figures.",
        "info",
      ),
  });
  // No before_agent_start hook, auto-routing model, background work or provider calls.
}
