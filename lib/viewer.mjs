import { randomUUID } from "node:crypto";
import { artifactRoot, listArtifacts, readArtifact } from "./artifacts.mjs";
import { viewerDocument, followupDraft } from "./documents.mjs";
export async function activateAether(
  api,
  { config, root = artifactRoot(config.namespace) },
) {
  const MESSAGE_TYPE = config.messageType;
  const ui = api.ui,
    nonce = randomUUID().replaceAll("-", "");
  const actions = Object.fromEntries(
    ["open", "show", "close", "draft", "resize"].map((name) => [
      name,
      name + "_" + nonce,
    ]),
  );
  let visible = false,
    rows = [],
    error = "";
  const heights = new Map(),
    rendered = new Map();
  const perform = (work) => async (args) => {
    try {
      error = "";
      await work(args);
    } catch (e) {
      error = e.message;
    }
    api.invalidate();
  };
  api.registerAction(
    actions.open,
    perform(async () => {
      rows = await listArtifacts(root);
      visible = true;
    }),
  );
  api.registerAction(
    actions.show,
    perform(async ({ id }) => {
      const record = await readArtifact(id, root);
      await api.messages.append(MESSAGE_TYPE, { id: record.id }, record.title);
      visible = false;
    }),
  );
  api.registerAction(actions.close, () => {
    visible = false;
    api.invalidate();
  });
  api.registerAction(actions.resize, ({ id, height }) => {
    if (!rendered.has(id) || !Number.isFinite(height)) return;
    const next = Math.max(240, Math.min(12000, Math.ceil(height)));
    if (Math.abs(next - (heights.get(id) || 560)) < 2) return;
    heights.set(id, next);
    api.invalidate();
  });
  api.registerAction(
    actions.draft,
    perform(async (args) => {
      const selected = rendered.get(args.id);
      if (!selected) throw Error("Reopen the visual before using a follow-up.");
      const text = followupDraft({
        ...args,
        title: selected.title,
        id: selected.id,
      });
      await api.host.invoke("app.appendDraftInput", { text: "\n\n" + text });
    }),
  );
  api.registerMessageType({
    type: MESSAGE_TYPE,
    title: "Interactive visual",
    icon: "code",
    render: async ({ message }) => {
      try {
        const artifact = await readArtifact(
          message.payload?.id,
          root,
        );
        rendered.set(artifact.id, { id: artifact.id, title: artifact.title });
        return ui.column(
          [
            ui.text(artifact.title, { weight: "semibold" }),
            ui.web({
              html: viewerDocument(
                config.anatomy
                  ? {
                      ...artifact,
                      html: await (
                        await import("./anatomy.mjs")
                      ).withAnatomyToolkit(artifact.html),
                    }
                  : artifact,
                actions.draft,
                actions.resize,
              ),
              height: heights.get(artifact.id) || 560,
              radius: 12,
            }),
          ],
          { width: "fill", spacing: 8 },
        );
      } catch (e) {
        return ui.text("Visual unavailable: " + e.message, { color: "error" });
      }
    },
  });
  api.registerComposerMenuItem({
    id: config.namespace,
    title: config.label,
    subtitle: "Reopen an interactive explanation in this chat",
    icon: "code",
    order: 40,
    action: actions.open,
  });
  api.registerSurface("app.overlay", {
    id: config.namespace,
    order: 100,
    render: () =>
      !visible
        ? null
        : ui.column(
            [
              ui.row(
                [
                  ui.text("Saved " + config.label.toLowerCase(), {
                    weight: "semibold",
                  }),
                  ui.button("Close", actions.close, { tone: "neutral" }),
                ],
                { wrap: true },
              ),
              ...(error ? [ui.text(error, { color: "error" })] : []),
              ...(rows.length
                ? rows.map((row) =>
                    ui.button(row.title, actions.show, {
                      args: { id: row.id },
                      tone: "neutral",
                      width: "fill",
                    }),
                  )
                : [
                    ui.text(
                      "Ask Aether for an interactive explanation. New visuals appear in your conversation.",
                    ),
                  ]),
            ],
            {
              width: "fill",
              padding: 24,
              spacing: 12,
              scroll: true,
              background: "background",
            },
          ),
  });
  return { actions };
}
