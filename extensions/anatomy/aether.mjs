import { activateAether as activateViewer } from "../../lib/viewer.mjs";
import { ANATOMY } from "../../lib/config.mjs";
export const activateAether = (api) => activateViewer(api, { config: ANATOMY });
