import {
  THEME_CSS,
  SVG_CLASSES_CSS,
  FORM_STYLES_CSS,
} from "../vendor/open-intelligent-ui/design-system.mjs";
const escape = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
export const DOCUMENT_POLICY =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; worker-src 'none'";
const bridge = `window.sendPrompt=function(text,values={}){parent.postMessage({type:'visual-followup',text,values},'*')};
window.Websandbox={connection:{remote:{sendPrompt:async function(args){window.sendPrompt(args.text,args.values||{});return {pendingReview:true}}}}};
new ResizeObserver(()=>parent.postMessage({type:'visual-height',height:document.documentElement.scrollHeight},'*')).observe(document.documentElement);`;
export function prepareDocument(html) {
  // Policy is parsed before ANY supplied markup and cannot be relaxed by a later meta tag.
  return `<meta http-equiv="Content-Security-Policy" content="${escape(DOCUMENT_POLICY)}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${THEME_CSS}\n${SVG_CLASSES_CSS}\n${FORM_STYLES_CSS}\nbody{margin:0;padding:16px;font-family:system-ui;background:var(--color-background-primary);color:var(--color-text-primary)}svg,canvas{max-width:100%}button,input,select{min-height:44px}button{touch-action:manipulation}@media(prefers-reduced-motion:reduce){*,*:before,*:after{animation-duration:0s!important;transition-duration:0s!important}}</style>${html}<script>${bridge}</script>`;
}
export function followupDraft({ title, id, text, values = {} }) {
  if (typeof text !== "string" || !text.trim() || text.length > 1200)
    throw Error("Follow-up must be 1–1,200 characters.");
  if (!values || typeof values !== "object" || Array.isArray(values))
    throw Error("Selected values must be an object.");
  const entries = Object.entries(values);
  if (
    entries.length > 16 ||
    entries.some(
      ([k, v]) =>
        k.length > 60 ||
        !["string", "number", "boolean"].includes(typeof v) ||
        (typeof v === "number" && !Number.isFinite(v)),
    )
  )
    throw Error("Use up to 16 scalar selected values.");
  const state = JSON.stringify(values);
  if (state.length > 1024) throw Error("Selected values exceed 1 KiB.");
  return `About the visual “${title}” (ID ${id}):\n${text.trim()}\nSelected values: ${state}\nUse visual_artifact to read the relevant source only if necessary. Do not load other visuals or conversation history.`;
}
export function viewerDocument(artifact, draftAction) {
  const source = JSON.stringify(prepareDocument(artifact.html)).replaceAll(
    "<",
    "\\u003c",
  );
  const action = JSON.stringify(draftAction),
    id = JSON.stringify(artifact.id);
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-src about:; base-uri 'none'; form-action 'none'"><style>body{margin:0;background:#fff;font:16px system-ui;color:#193b31}iframe{display:block;width:100%;height:460px;border:0}#review{margin:12px;padding:16px;border:1px solid #b8c9bd;border-radius:12px}button{padding:12px;min-height:44px;border-radius:8px;background:#245d47;color:#fff;border:0}p{white-space:pre-wrap;overflow-wrap:anywhere}#hint{font-size:13px;margin:12px;color:#53685e}</style></head><body><iframe id="visual" sandbox="allow-scripts" title="Interactive visual" referrerpolicy="no-referrer"></iframe><div id="review" hidden><strong>Review follow-up</strong><p id="text"></p><button id="approve">Put this in my chat draft</button><button id="dismiss">Dismiss</button></div><p id="hint">Controls run locally. A follow-up is sent only after you review it and send your chat draft.</p><script>
const frame=document.getElementById('visual');let pending=null;frame.srcdoc=${source};
addEventListener('message',event=>{if(event.source!==frame.contentWindow||!event.data||typeof event.data!=='object')return;const data=event.data;
if(data.type==='visual-height'&&Number.isFinite(data.height)){frame.style.height=Math.max(240,Math.min(900,data.height))+'px';return;}
if(data.type!=='visual-followup'||typeof data.text!=='string'||!data.text.trim()||data.text.length>1200)return;
const values=data.values??{};if(!values||typeof values!=='object'||Array.isArray(values)||JSON.stringify(values).length>1024||Object.keys(values).length>16)return;
if(Object.entries(values).some(([k,v])=>k.length>60||!['string','number','boolean'].includes(typeof v)||typeof v==='number'&&!Number.isFinite(v)))return;
pending={id:${id},text:data.text,values};document.getElementById('text').textContent=data.text+'\\nSelected values: '+JSON.stringify(values);document.getElementById('review').hidden=false;});
document.getElementById('approve').onclick=event=>{if(!event.isTrusted||!pending)return;const message=JSON.stringify({action:${action},args:pending});
if(window.Aether?.postMessage){window.Aether.postMessage(message);pending=null;document.getElementById('review').hidden=true;}else document.getElementById('text').textContent='Aether is unavailable in this preview. No request was sent.';};
document.getElementById('dismiss').onclick=()=>{pending=null;document.getElementById('review').hidden=true;};
</script></body></html>`;
}
