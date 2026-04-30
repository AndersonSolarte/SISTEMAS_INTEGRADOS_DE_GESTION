const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const CACHE_TTL_MS = Number(process.env.GOOGLE_DRIVE_EVIDENCE_CACHE_TTL_MS || 5 * 60 * 1000);
const evidenceCache = new Map();

const extractFolderId = (folderUrl = '') => {
  const raw = String(folderUrl || '').trim();
  if (!raw) return '';

  const patterns = [
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/drive\/u\/\d+\/folders\/([a-zA-Z0-9_-]+)/
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match?.[1]) return match[1];
  }

  if (/^[a-zA-Z0-9_-]{20,}$/.test(raw)) return raw;
  return '';
};

const buildDriveClient = () => {
  const apiKey = String(process.env.GOOGLE_DRIVE_API_KEY || '').trim();
  const clientEmail = String(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim();
  const privateKey = String(process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
  const credentialsJson = String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
  const credentialsPath = String(process.env.GOOGLE_SERVICE_ACCOUNT_FILE || '').trim();

  if (clientEmail && privateKey) {
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });
    return google.drive({ version: 'v3', auth });
  }

  const parseCredentials = (source) => {
    const cleanSource = String(source || '').trim();
    if (!cleanSource) return null;
    if (cleanSource.startsWith('{')) return JSON.parse(cleanSource);

    const resolvedPath = path.isAbsolute(cleanSource)
      ? cleanSource
      : path.resolve(__dirname, '../../', cleanSource);

    if (!fs.existsSync(resolvedPath)) {
      const err = new Error(`No se encontro el archivo de credenciales de Google Drive: ${cleanSource}`);
      err.statusCode = 503;
      throw err;
    }

    return JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  };

  if (credentialsJson || credentialsPath) {
    const credentials = parseCredentials(credentialsJson || credentialsPath);
    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: String(credentials.private_key || '').replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });
    return google.drive({ version: 'v3', auth });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });
    return google.drive({ version: 'v3', auth });
  }

  if (apiKey) {
    return google.drive({ version: 'v3', auth: apiKey });
  }

  const err = new Error('Google Drive no esta configurado. Define una cuenta de servicio o GOOGLE_DRIVE_API_KEY.');
  err.statusCode = 503;
  throw err;
};

const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';

const normalizeDriveFile = (file) => {
  const isFolder = file.mimeType === DRIVE_FOLDER_MIME;
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    modifiedTime: file.modifiedTime,
    isFolder,
    folderUrl: isFolder && file.id ? `https://drive.google.com/drive/folders/${file.id}` : '',
    webViewLink: file.webViewLink || (file.id
      ? (isFolder ? `https://drive.google.com/drive/folders/${file.id}` : `https://drive.google.com/file/d/${file.id}/view`)
      : ''),
    webContentLink: isFolder ? '' : (file.webContentLink || (file.id ? `https://drive.google.com/uc?id=${file.id}&export=download` : '')),
    previewLink: !isFolder && file.id ? `https://drive.google.com/file/d/${file.id}/preview` : ''
  };
};

const listEvidenceFiles = async (folderUrl) => {
  const folderId = extractFolderId(folderUrl);
  if (!folderId) {
    const err = new Error('No se pudo identificar el ID de la carpeta de Google Drive.');
    err.statusCode = 400;
    throw err;
  }

  const cached = evidenceCache.get(folderId);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    return cached.files;
  }

  const drive = buildDriveClient();
  const files = [];
  let pageToken = undefined;

  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id,name,mimeType,modifiedTime,webViewLink,webContentLink)',
      orderBy: 'modifiedTime desc,name',
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });
    files.push(...(response.data.files || []).map(normalizeDriveFile));
    pageToken = response.data.nextPageToken;
  } while (pageToken);

  evidenceCache.set(folderId, { createdAt: Date.now(), files });
  return files;
};

module.exports = {
  extractFolderId,
  listEvidenceFiles
};
