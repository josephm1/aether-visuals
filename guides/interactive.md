# Interactive answers for Aether

Use a visual only when interaction clarifies the answer: inspect a mechanism,
change assumptions, compare alternatives, solve a puzzle or use a small tool.
Ordinary facts still deserve ordinary text. This guide is loaded on demand.

Write ONE self-contained HTML file in the current workspace. Call visual_artifact
with action show, title, kind interactive, and its file path. The tool snapshots the
file, returns a small ID, and makes it available under Visuals in Aether's composer
menu. It does not return the document to the model. Use action example to test.

The runtime supports HTML, inline CSS, inline JavaScript, SVG, Canvas and WebGL.
No React build, CDN, external requests, eval, modules imported from the network,
iframes, parent DOM, native APIs, file access or browser storage. Inline any library
code genuinely needed. Default to simple SVG/DOM; use WebGL only when it helps.
The viewer supplies OpenIntelligentUI theme, SVG helper and form CSS. No Python
agent, routing model or second provider account is involved.

Compute values from one explicit local model; label assumptions, units and data
provenance. A simulation is illustrative unless validated. Local interactions must
not silently ask AI, perform network calls or pretend to have live data. Don't
show fabricated loading/progress. Explain what the user can manipulate.

Phone and e-ink: a responsive viewBox, no horizontal overflow at 320px, legible text,
44px touch controls, keyboard equivalents and visible focus. Use pointer events
and buttons instead of hover-only actions. Provide Pause/Reset for animation and
respect prefers-reduced-motion. A new diagram starts still; the user starts motion.

To offer a follow-up, use a button's click handler:
sendPrompt('Explain why the result changes', {mass: 2, acceleration: 3})
Only 16 scalar named values, total 1 KiB, and 1,200 characters of text are accepted.
The trusted viewer shows the proposed text/values; the user must approve a chat
draft, then send it. This is not a way to run tools directly. A follow-up needs
only the visual ID, question and selected values. If source is required, read only
the relevant local HTML file; don't resend the whole source or old visual history.

Deliver a concise explanation alongside the visual, including known limits. Test
the actual controls, computations, resize, keyboard and touch behavior before
claiming it works. Rendering the page is not a correctness test.
