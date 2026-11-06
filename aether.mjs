import { randomUUID } from "node:crypto";
import { artifactRoot, listArtifacts, readArtifact } from "./lib/artifacts.mjs";
import { viewerDocument, followupDraft } from "./lib/documents.mjs";
export async function activateAether(api, { root = artifactRoot() } = {}) {
  const ui = api.ui,
    nonce = randomUUID().replaceAll("-", ""),
    actions = {
      open: "open_" + nonce,
      show: "show_" + nonce,
      close: "close_" + nonce,
      draft: "draft_" + nonce,
    };
  let visible = false,
    rows = [],
    selected = null,
    error = "";
  const refresh = async () => {
    rows = await listArtifacts(root);
  };
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
      await refresh();
      visible = true;
      selected = null;
    }),
  );
  api.registerAction(
    actions.show,
    perform(async ({ id }) => {
      selected = await readArtifact(id, root);
      visible = true;
    }),
  );
  api.registerAction(actions.close, () => {
    visible = false;
    selected = null;
    api.invalidate();
  });
  api.registerAction(
    actions.draft,
    perform(async (args) => {
      if (!visible || !selected || args.id !== selected.id)
        throw Error("Reopen the visual before using a follow-up.");
      const text = followupDraft({
        ...args,
        title: selected.title,
        id: selected.id,
      });
      await api.host.invoke("app.openScreen", { screen: "chat" });
      await api.host.invoke("app.appendDraftInput", { text: "\n\n" + text });
      visible = false;
      selected = null;
    }),
  );
  api.registerComposerMenuItem({
    id: "visuals",
    title: "Visuals",
    subtitle: "Interactive explanations and Anatomy figures",
    icon: "code",
    order: 40,
    action: actions.open,
  });
  api.registerSurface("app.overlay", {
    id: "visuals",
    order: 100,
    render: () =>
      !visible
        ? null
        : ui.column(
            [
              ui.row(
                [
                  ui.text(selected?.title || "Interactive visuals", {
                    weight: "semibold",
                  }),
                  ui.button("Close", actions.close, { tone: "neutral" }),
                ],
                { wrap: true },
              ),
              ...(error ? [ui.text(error, { color: "error" })] : []),
              ...(selected
                ? [
                    ui.web({
                      html: viewerDocument(selected, actions.draft),
                      height: 560,
                      radius: 12,
                    }),
                  ]
                : rows.length
                  ? rows.map((row) =>
                      ui.button(row.title, actions.show, {
                        args: { id: row.id },
                        tone: "neutral",
                        width: "fill",
                      }),
                    )
                  : [
                      ui.text(
                        "Ask Aether for an interactive explanation, then open Visuals. You can also ask it to show an example.",
                      ),
                    ]),
            ],
            {
              height: "fill",
              width: "fill",
              padding: 16,
              spacing: 12,
              scroll: true,
              background: "background",
            },
          ),
  });
  return { actions };
}
