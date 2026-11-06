import { activateAether } from "../../lib/viewer.mjs";
import { INTERACTIVE_UI } from "../../lib/config.mjs";
export const activateAetherExtension = (api) =>
  activateAether(api, { config: INTERACTIVE_UI });
export { activateAetherExtension as activateAether };
