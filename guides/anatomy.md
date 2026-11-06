# Anatomy figures in Aether

Use the original wheresryan22/anatomy toolkit for intricate isometric explanatory
figures. It is a drawing skill, not a human anatomy atlas. Its MIT licence and
pinned upstream revision are in vendor/anatomy. Read only the relevant reference,
not the whole kit and all examples. Nothing is injected into unrelated chat.

First establish the concept, source-backed numbers and physical mechanism. Then
build a small model that drives both geometry and readouts. Do not invent facts to
justify an attractive diagram. Use the framework-free SVG route first.

The bundled working reference is vendor/anatomy/examples/dial-indicator/build.mjs.
Run it with Node and --light for a standalone HTML figure. The extension's action
example, kind anatomy shows a touch-adapted copy with pause and block buttons.

Read vendor/anatomy/references/kit.md for geometry, craft.md for construction and
motion.md for interaction. Optional webgl.md and 3d.md are loaded only for that task.
The original SKILL.md is available if a complete specialist workflow is needed.
Use existing read/bash tools with the absolute kit path returned by this tool.
Copy a build script to the workspace and update its kit imports to that path;
do not overwrite packaged examples. Build the HTML there, then call visual_artifact
with action show, kind anatomy, title and the file path.

Adapt interactions for touch: pointerdown/move/up and accessible buttons/sliders,
44px targets, 320px layout, keyboard support, stopped initial animation and Pause/
Reset. Honor reduced motion and provide a useful still SVG if WebGL is unavailable.
Use only inline scripts, styles and data images: no remote fonts/scripts, network,
embedded pages or native bridge. Headless Chrome validation runs on a development
computer; do not assume desktop Chrome scripts run on Android/iOS. Verify in the
actual target WebView as a separate stage. The existing Aether extension web node
renders the result on both platform paths; iOS device validation remains required.
