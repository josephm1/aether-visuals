# Implementation decisions

Reviewed against primary sources on 6 November 2026:

- [Pi extensions](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md):
  compact `promptSnippet`, model-facing `content`, structured `details`, persisted
  custom messages, and reconstruction from the active branch.
- [OpenIntelligentUI architecture](https://github.com/CopilotKit/OpenIntelligentUI/blob/main/docs/architecture.md):
  choose text or useful custom UI, isolate generated code, validate callbacks, and
  bound resize messages. Its full Python/CopilotKit/router stack is unnecessary here.
- [Anatomy](https://github.com/wheresryan22/anatomy/blob/main/SKILL.md): explanatory
  physical objects, consistent geometry/readout models, painter order, depth and
  purposeful interaction. The current extension ships the browser-safe SVG module.
- [MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview) and
  [official SDK overview](https://apps.extensions.modelcontextprotocol.io/api/documents/Overview.html):
  embed interactive resources in the conversation, mediate host capabilities and
  preserve text alongside UI. Full MCP App interoperability is a later integration;
  these extensions do not claim protocol compliance.
- [Android native-bridge guidance](https://developer.android.com/privacy-and-security/risks/insecure-webview-native-bridges):
  JavaScript interfaces reach subframes, so an iframe alone is insufficient. Native
  action IDs remain unpredictable and outside generated content; exposed operations
  are bounded sizing and user-reviewed drafting, not automatic tool execution.

The selected implementation uses Pi and Aether's existing extension APIs, one
shared viewer source, two independent products and no additional model backend.
Generated HTML is passed directly to its tool, avoiding mismatched Termux/Alpine
paths. Neither tool copies a drawing library into model output. Anatomy injects
its local pinned module only when rendering an Anatomy figure.

Pi defers custom messages queued with `triggerTurn:false` until a turn settles.
The bridge collects newly committed display messages from the active branch after
idle, then includes them in the completion payload. Both native clients consume
that payload. This avoids depending on transient event order or scanning files at
turn completion. Artifact IDs and short titles accompany the conversation; document
bodies remain in immutable local snapshots.

No legacy combined-extension loader, automatic migration, provider-specific visual
backend, background HTTP server or fake Websandbox compatibility object is retained.
