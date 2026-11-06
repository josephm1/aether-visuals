import fs from "node:fs/promises";
import {
  artifactRoot,
  saveArtifact,
  listArtifacts,
  readArtifact,
} from "./artifacts.mjs";
export const createToolDefinition = (config) => ({
  name: config.toolName,
  label: config.label,
  description: config.anatomy
    ? "Create an intricate isometric SVG mechanism inline in chat. The original Anatomy geometry kit is available as window.anatomy; read the focused guide before drawing. Supply title and HTML content."
    : "Create a custom interactive HTML/SVG/Canvas explanation inline in chat. Supply title and self-contained content. Read the focused guide only if needed. Controls run locally; tool results contain metadata only.",
  promptSnippet: config.anatomy
    ? "Draw detailed interactive isometric mechanisms with the Anatomy kit."
    : "Create an interactive diagram, calculator or simulation when it clarifies an answer.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string" },
      id: { type: "string" },
      offset: { type: "integer", minimum: 0 },
      content: { type: "string" },
      action: { type: "string", enum: ["render", "guide", "list", "read"] },
    },
    additionalProperties: false,
  },
});
export async function executeVisual(args, root, config) {
  if (args.action === "guide")
    return {
      guide: await fs.readFile(
        new URL("../guides/" + config.guide + ".md", import.meta.url),
        "utf8",
      ),
    };
  if (args.action === "list") return { visuals: await listArtifacts(root) };
  if (args.action === "read") {
    const artifact = await readArtifact(args.id, root);
    const offset =
      Number.isInteger(args.offset) && args.offset >= 0 ? args.offset : 0;
    return {
      id: artifact.id,
      title: artifact.title,
      content: artifact.html.slice(offset, offset + 6000),
      nextOffset: offset + 6000 < artifact.html.length ? offset + 6000 : null,
    };
  }

  if (args.action && args.action !== "render")
    throw Error("Unknown visual action.");
  if (typeof args.content !== "string" || !args.content.trim())
    throw Error("Provide self-contained HTML content.");
  return saveArtifact({ html: args.content, title: args.title }, root);
}
export function compactVisualContext(messages, toolName) {
  return messages.map((message) =>
    message.role !== "assistant" || !Array.isArray(message.content)
      ? message
      : {
          ...message,
          content: message.content.map((part) =>
            part.type === "toolCall" &&
            part.name === toolName &&
            typeof part.arguments?.content === "string"
              ? {
                  ...part,
                  arguments: {
                    ...part.arguments,
                    content:
                      "[Saved visual source omitted. Use action read with its artifact ID only when editing it.]",
                  },
                }
              : part,
          ),
        },
  );
}
export function activateAgent(pi, config) {
  pi.on("context", (event) => ({
    messages: compactVisualContext(event.messages, config.toolName),
  }));
  pi.registerTool({
    ...createToolDefinition(config),
    execute: async (_call, args) => {
      const result = await executeVisual(
        args,
        artifactRoot(config.namespace),
        config,
      );
      if (result.id && result.sha256)
        pi.sendMessage(
          {
            customType: config.messageType,
            content: result.title,
            display: true,
            details: { id: result.id },
          },
          { triggerTurn: false },
        );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              result.id && result.sha256
                ? {
                    id: result.id,
                    title: result.title,
                    status: "Rendered inline",
                  }
                : result,
            ),
          },
        ],
        details: result,
      };
    },
  });
  pi.registerCommand(config.namespace, {
    description: "Interactive visual authoring help",
    handler: async (_args, ctx) =>
      ctx.ui.notify(
        `Ask for a visual explanation. ${config.toolName} creates a figure inline; ${config.label} reopens saved figures.`,
        "info",
      ),
  });
}
