import { activateAether } from "../../lib/viewer.mjs";
import { ANATOMY } from "../../lib/config.mjs";
export const activateAetherExtension = (api) =>
  activateAether(api, { config: ANATOMY });
export { activateAetherExtension as activateAether };
