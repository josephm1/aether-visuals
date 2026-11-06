# Two independent extension tests

Import either or both packages and enable their Pi and Aether parts. The host
must include the generic Pi custom-message change on the linked host-support branch.
Disable/remove the old combined beta if it is installed; these are independent replacements, with no automatic migration. Start a fresh chat for each test. No old sessions, data migrations or named demos
are needed. Physical interaction is performed by the device tester.

## Interactive UI

> Explain why a triangle’s area is half its base times its height. Create an
> interactive diagram with a base of 10 units, an initial height of 6 units and a
> draggable top vertex. Show live base, perpendicular height and area values, and
> include Reset. Keep the diagram in this conversation with a short explanation.

Pass criteria:

- The actual diagram appears in the same chat as the explanation, rather than
  only a claim that it exists or a separate overlay.
- Initially the area is 30 square units. Moving the vertex horizontally without
  changing its height preserves the area. Moving it vertically changes it.
- Reset returns to the initial state. Labels and controls are reachable by normal
  chat scrolling, with no clipped panel.
- Controls respond locally, without another agent run for each move.
- Reopening the conversation retains the saved visual. A proposed follow-up, if
  included, is reviewed as a draft before it is sent.

## Anatomy

> Use the Anatomy drawing style to explain a spring-loaded dial indicator. Create
> a detailed isometric test stand with a base, upright post, gauge body, plunger
> and visible spring. Give me a slider that moves the plunger and drives the dial
> reading from the same model, selectable parts with short explanations, an
> exploded-view control and Reset. Keep the figure inline in this conversation.
> Label it as an illustrative mechanism.

Pass criteria:

- A newly drawn isometric mechanism appears; it is not a flat block diagram or a
  preselected demo. The agent uses `render_anatomy` and its on-demand guide.
- Parts have credible depth and shading. The spring, plunger and dial agree with
  one local model. Exact manufacturing accuracy is not implied.
- Selection changes the explanation, separation changes actual part geometry,
  and Reset restores the assembled starting state.
- Touch targets work without hover; all controls remain reachable by scrolling.
- The drawing stays with the originating chat and does not trigger AI per control.

## Automated coverage

`npm test` checks separate tools, message types, storage, document integrity,
bounds, lazy Anatomy injection, model-facing results and reviewed drafts.
`npm run test:browser` checks a real generated triangle’s drag/math/keyboard/reset,
the actual Anatomy SVG module’s geometry/selection/separation/reset, an intricate
reference engine, a gauge, phone widths, content height and iframe isolation.
`npm run test:host` loads **both packaged ZIPs together** through Aether’s real
extension bridge and renders their distinct saved messages.

A separate native bridge regression runs a real Pi extension against a scripted
local provider, queues a standard `sendMessage` with `triggerTurn:false`, and
checks that the committed display message reaches the completion payload. No paid
provider or fake touchscreen interaction is used for that regression.

Passing these tests does not prove every future generated diagram is correct.
The final physical-device flow remains a manual test. Android build/unit checks
have run; iOS device compilation/interaction requires a Mac and remains pending.
