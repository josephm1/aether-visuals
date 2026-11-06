# Interactive Visuals for Aether

Rich interactive answers using Aether's existing agent and model: SVG diagrams,
local calculators, simulations, Canvas/WebGL, and intricate isometric figures
using the original **Anatomy** toolkit. One extension, one viewer; optional drawing
references are loaded only when needed. No CopilotKit server, Python backend,
second router model, separate credentials or provider SDK is installed.

## Install and try

Import `aether-visuals-0.1.0.zip` using Aether → Settings → Extensions → Import
extension. Enable its Pi and Aether parts. It uses existing API v2 features,
including a composer menu and web node; it does not depend on the Apps extension
or the pending native web-app-host PR. No native Aether source was changed.

Ask Aether:

> Show the Anatomy dial indicator example using visual_artifact.

Then open **Visuals** from the composer's extension menu and choose the figure.
Its block buttons, drag controls, Play/Pause and Reset work locally. For the more
intricate rocket engine, ask for action `example`, kind `anatomy`, example `engine`.
It supports selecting assemblies, taking the engine apart and an optional shader
plume, with no automatic tour and an explicit Stop and reset button. Or ask:

> Give me an interactive explanation of net force. Use visual_artifact to show
> the force lab example, then explain its assumptions.

For a custom figure:

> Explain this mechanism with a detailed interactive isometric drawing. Read
> visual_artifact's Anatomy guide, use the bundled kit, write a standalone HTML
> file in this workspace, then show it with visual_artifact.

The tool's `guide` action returns a focused guide and, for Anatomy, the absolute
kit location. Aether's normal file/build tools do the authoring. The `show` action
snapshots the file and returns a small artifact ID. It does not send its HTML back
to the model. Open the library explicitly to see new artifacts; rendering does not
require keeping the originating agent session running. The last 20 valid artifacts
are listed; older files remain stored and are not automatically deleted.

## Behavior and boundaries

- **Render:** self-contained HTML, CSS, JavaScript, SVG, Canvas and WebGL. Touch,
  responsive layout and accessible controls are part of the authoring guide.
- **Interact:** calculations and animation are local. Controls make no AI requests.
  Examples start still. Pause/Reset and reduced-motion support are included.
- **Follow up:** `sendPrompt(text, values)` shows a proposal in the trusted viewer.
  The user reviews and approves a chat draft, then sends it using Aether. Only the
  visual ID, text and selected scalar values are included, not the HTML/kit/history.
- **Persist:** immutable HTML snapshots with title, ID and SHA-256 under the
  extension runtime's `~/.aether/visuals`. The two Aether bridge processes share
  those files rather than an in-memory singleton. No local browser replicas.
- **Isolate:** generated documents use an opaque-origin `sandbox="allow-scripts"`
  iframe with restrictive CSP. No parent DOM, network resources, forms, workers,
  nested frames, popups, eval or CDN imports. The parent accepts only bounded
  resize/follow-up messages from that frame. Host action IDs are random, kept in
  the parent and never given to the generated document. On Android/iOS the generic
  native web bridge may also be injected into subframes: no well-known privileged
  extension actions are registered. The only approval action creates a draft;
  generated content receives no model/file/installation capability.

A follow-up can suggest text but cannot send a message, run tools, or invoke AI.
Do not treat generated UI as verified science. Models must state assumptions and
sources, and controls/math must be tested. Complex visuals may cost more to generate
than plain text; local rendering is free of provider calls.

## Context efficiency

Activation registers one compact tool and a menu; it does not read guides, scan
visuals, run a model, append a system prompt or install a `before_agent_start` hook.
Guide/kit/example bodies are read only when explicitly requested. `show` returns
metadata rather than duplicating code in a tool result. A later follow-up is capped
at 1,200 characters of text and 1 KiB of up to 16 scalar values. HTML is limited to
2 MiB. These are byte/character bounds, not model token counts. No live provider
request was made during validation, so no measured token-usage claim is made.

## Current scope

This adapts the **capabilities**, not the full OpenIntelligentUI application. It
uses that project's MIT theme/SVG/form styles and the reviewed-follow-up concept.
It includes the original MIT Anatomy kit and references, plus dial and detailed rocket-engine examples
adapted for touch and stopped initial motion. Full Next.js/CopilotKit/AG-UI streaming,
Jev routing, MCP serving, cloud deployment and telemetry are not included.

Visuals currently open in an extension overlay, not as streaming inline chat
artifacts. Automatic screenshot/geometry validation, arbitrary external libraries,
3D scene editing and arbitrary MCP app integration are not implemented. The kit's
original development scripts may require desktop Chrome; that does not imply they
work in the mobile runtime. Heavy WebGL/3D needs target-device performance checks.

Android's native extension renderer and iOS's shared renderer both support the
web node used here. Desktop Chromium and the real Aether extension bridge were
tested. **This new ZIP has not been installed or tested on Android/iOS hardware**;
no cross-platform device-parity claim is made. Existing Apps/web-app data is untouched.

## Development and verification

Node 22+ and Python 3 for packaging:

```sh
npm ci --ignore-scripts
npm test
CHROME_PATH=/path/to/chromium npm run test:browser
AETHER_EXTENSION_BRIDGE=/path/to/Aether/pi-bridge/dist/extension-bridge.mjs npm run test:host
npm run package
```

Runtime uses Node built-ins only; Puppeteer is a development-only browser test
library. Packaging allowlists the runtime files and excludes dependencies, tests,
verification captures, generated snapshots and credentials. Tests cover actual
control results, keyboard/touch behavior, viewport width, isolation, reviewed
follow-up gating, source bounds/integrity, and native extension loading/rendering.

## Licences

Original adapter code: MIT. Upstream attribution, licences and pinned revisions:

- [wheresryan22/anatomy](https://github.com/wheresryan22/anatomy), MIT:
  `vendor/anatomy/LICENSE` and `UPSTREAM.json`. Unmodified toolkit and reference
  files retain their upstream wording. Touch adaptation is in `lib/examples.mjs`.
- [CopilotKit/OpenIntelligentUI](https://github.com/CopilotKit/OpenIntelligentUI),
  MIT: `vendor/open-intelligent-ui/LICENSE` and `UPSTREAM.json`. The runtime CSS
  subset is taken from `packages/design-system/src/index.ts`.

The upstream guides are source material; this extension does not auto-publish
figures, send telemetry or execute upstream installation/publishing scripts.
