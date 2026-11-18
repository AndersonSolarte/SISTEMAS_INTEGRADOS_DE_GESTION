const fs = require('node:fs');
const path = require('node:path');
const { escapeHtml } = require('../emailService');

const ROOT = path.resolve(__dirname, '../../../uploads/desplazamientos_viaticos');
const TYPES = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

const resolveApprovalSupport = (solicitud, root = ROOT) => {
  const support = solicitud?.datos_viaticos?.soporteAdjunto;
  const filename = String(support?.filename || '').trim();
  if (!filename || /[\\/]/.test(filename) || !TYPES[path.extname(filename).toLowerCase()]) return null;
  try {
    const directory = fs.realpathSync(root);
    const filepath = fs.realpathSync(path.resolve(directory, filename));
    if (!filepath.startsWith(directory + path.sep) || !fs.statSync(filepath).isFile()) return null;
    return { id: 'soporte', filepath, name: path.basename(String(support.originalName || filename)), type: TYPES[path.extname(filename).toLowerCase()] };
  } catch (_) { return null; }
};

const approvalAttachmentViewerHtml = token => token ? `
  <style>
  .attachment-open{min-width:0;background:#fff;color:#0b3a6f;border:1px solid #bfdbfe;margin-left:auto;white-space:normal}
  .attachment-dialog{width:min(1100px,95vw);height:90vh;max-height:95vh;padding:0;border:0;border-radius:14px;color:#172033;background:white;box-shadow:0 24px 80px #0f172a60}
  .attachment-dialog::backdrop{background:#0f172aa6}.attachment-layout{height:100%;display:flex;flex-direction:column}
  .attachment-header{display:flex;gap:12px;align-items:center;justify-content:space-between;padding:14px 18px;background:#0b3a6f;color:white}
  .attachment-header h2{font-size:18px;margin:0}.attachment-header button{min-width:0;padding:9px 14px;background:white;color:#0b3a6f}
  .attachment-list{display:flex;gap:8px;flex-wrap:wrap;padding:10px 16px;border-bottom:1px solid #dbeafe}.attachment-list button{min-width:0;padding:8px 12px;background:#eff6ff;color:#0b3a6f;overflow-wrap:anywhere}
  .attachment-list button[aria-pressed="true"]{background:#0b3a6f;color:white}.attachment-status{padding:8px 16px;color:#475569;font-size:14px;overflow-wrap:anywhere}
  .attachment-content{min-height:0;flex:1;display:flex;align-items:center;justify-content:center;background:#f1f5f9;overflow:auto}
  .attachment-content iframe{border:0;width:100%;height:100%;background:white}.attachment-content img{display:block;max-width:100%;max-height:100%;object-fit:contain}
  @media(max-width:640px){.attachment-dialog{width:98vw;height:94vh}.attachment-header{padding:12px}.attachment-header h2{font-size:15px}.attachment-open{margin-left:0}}
  </style>
  <button type="button" class="attachment-open" data-open-attachments data-attachments-url="/api/desplazamientos-viaticos/accion/${escapeHtml(token)}/adjuntos">Visualizar documentos adjuntos</button>
  <dialog class="attachment-dialog" aria-labelledby="attachment-title"><div class="attachment-layout">
    <div class="attachment-header"><h2 id="attachment-title">Documentos adjuntos a la solicitud</h2><button type="button" data-close-attachments>Cerrar visor</button></div>
    <div class="attachment-list" aria-label="Documentos disponibles"></div><div class="attachment-status" role="status" aria-live="polite"></div>
    <div class="attachment-content"></div>
  </div></dialog>
  <script src="/api/desplazamientos-viaticos/assets/adjuntos.js?v=20261118" defer></script>
` : '';

module.exports = { resolveApprovalSupport, approvalAttachmentViewerHtml };
