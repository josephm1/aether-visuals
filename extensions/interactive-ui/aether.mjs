import { activateAether as activateViewer } from "../../lib/viewer.mjs";
import { INTERACTIVE_UI } from "../../lib/config.mjs";
export const activateAether = (api) => activateViewer(api, { config: INTERACTIVE_UI });
