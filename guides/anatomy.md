# Anatomy drawings in Aether

Use render_anatomy for intricate isometric explanatory SVG. This uses the original
MIT Anatomy geometry toolkit, not a human anatomy atlas. Aether injects the pinned
browser-safe kit and its stylesheet before your content. Do not copy kit source,
import modules, write files or run build scripts in another runtime.

Call render_anatomy with title and your complete HTML in content.
Your script can use `window.anatomy` immediately. Wrap the figure in
`<div class="iso" data-theme="light">`. Prefer SVG with an explicit responsive
viewBox and accessible buttons. No external resources or native bridge calls.

Key functions (`k = window.anatomy`):

- `fitProjection(points3d, width, height, {pad:24,azimuth:45,elevation:30})`
- `iso([x,y,z], P)` projects a world point to SVG coordinates; z points upward.
- `boxCorners({x,y,w,d,r}, z0, z1)` gives fitting extremes.
- `slabOf({x,y,w,d,r}, z, height, P, steps=8, bevel=0)` gives rounded-box paths.
- `cylinder(cx,cy,r,z,height,P,steps=32,bevel=0)` gives round solid paths.
- `solidSvg(paths,{tone:'hi'})` returns styled SVG markup.
- `lineSvg(path,{tone:'lo',dashed:false})`, `segment(point3d,point3d,P)`.
- `depthOf(point3d,P)` sorts solids far-to-near; painter order matters.
- `figureSvg({width,height,label,body})` wraps SVG markup accessibly.

For example, compute a projection from a part's boxCorners, then set an SVG
container's innerHTML to `k.solidSvg(k.slabOf(plan,0,20,P),{tone:'hi'})`.
Use the same geometric model for projected parts, labels and measurements.
Fit ALL corners of ALL parts, including the maximum exploded/lift positions; two
opposite corners do not bound an isometric projection. For a rectangular volume:
`const corners=[xmin,xmax].flatMap(x=>[ymin,ymax].flatMap(y=>[zmin,zmax].map(z=>[x,y,z])));`
Reserve space for labels outside the mechanism. Keep the camera fixed across
control states. The viewer expands toolkit figure bounds to contain visible
geometry, but that does not replace a correctly fitted scene or prevent labels
from colliding with each other. Keep controls below the SVG in normal flow.

For an exploded view, store each part's world-space position, height and separation
vector, then recompute its paths from one local slider value. Provide named part
buttons and a text explanation. Keep source facts separate from illustrative
geometry; label a schematic as schematic. Do not invent precision or internal parts.

Start still. Use pointer events and buttons, 44px controls, readable labels, a 320px
layout, keyboard access, Reset and Pause where relevant, and reduced-motion support.
Keep controls in the document flow so chat can expose them by scrolling. Test
selection, separation, reset and actual SVG geometry, not just button labels.
