const path = require('path');
const { google } = require('googleapis');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const {
  buildActionRepositoryDriveClient,
  hasUsableActionRepositoryOAuth
} = require('../services/actionPlanRepositoryDriveService');

async function runDiagnostic() {
  console.log('\n=============================================================');
  console.log('    DIAGNÓSTICO DE CONEXIÓN: GOOGLE DRIVE Y CORREO SIAC');
  console.log('=============================================================\n');

  // 1. Diagnóstico de variables de entorno de Drive
  const rootId = String(process.env.SIAC_ACTION_REPOSITORY_ROOT_ID || process.env.SIAC_PEI_DRIVE_ROOT_ID || '').trim();
  const clientId = String(process.env.PLAN_ACTION_GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.PLAN_ACTION_GOOGLE_CLIENT_SECRET || '').trim();
  const refreshToken = String(process.env.PLAN_ACTION_GOOGLE_REFRESH_TOKEN || '').trim();
  const serviceAccount = String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_FILE || '').trim();

  console.log('1. REVISIÓN DE VARIABLES DE ENTORNO:');
  console.log('-------------------------------------------------------------');
  console.log(`- SIAC_ACTION_REPOSITORY_ROOT_ID : ${rootId ? '✓ DEFINIDA (' + rootId.slice(0, 8) + '...)' : '❌ NO DEFINIDA / VACÍA'}`);
  console.log(`- PLAN_ACTION_GOOGLE_CLIENT_ID  : ${clientId ? '✓ DEFINIDA' : '❌ NO DEFINIDA / VACÍA'}`);
  console.log(`- PLAN_ACTION_GOOGLE_CLIENT_SECRET: ${clientSecret ? '✓ DEFINIDA' : '❌ NO DEFINIDA / VACÍA'}`);
  console.log(`- PLAN_ACTION_GOOGLE_REFRESH_TOKEN: ${refreshToken ? (refreshToken.startsWith('1//') ? '✓ DEFINIDA (Formato correcto 1//...)' : '⚠️ DEFINIDA PERO NO INICIA CON 1//') : '❌ NO DEFINIDA / VACÍA'}`);
  console.log(`- GOOGLE_SERVICE_ACCOUNT_JSON   : ${serviceAccount ? '✓ DEFINIDA' : '⚠️ NO DEFINIDA'}`);

  const usingOAuth = hasUsableActionRepositoryOAuth();
  console.log(`\nModo de autenticación detectado: ${usingOAuth ? '🟢 OAuth 2.0 (Permite subir archivos Excel y PDF con cuota)' : '🟠 Cuenta de Servicio (SOLO carpetas, Google rechaza archivos)'}`);

  // 2. Probar conexión con Google Drive
  console.log('\n2. PRUEBA DE CONEXIÓN CON GOOGLE DRIVE:');
  console.log('-------------------------------------------------------------');
  if (!rootId) {
    console.error('❌ ERROR FATAL: Falta SIAC_ACTION_REPOSITORY_ROOT_ID. Configure esta variable con el ID de la carpeta raíz de Drive.');
    return;
  }

  let drive;
  try {
    drive = buildActionRepositoryDriveClient();
    console.log('✓ Cliente de Google Drive inicializado correctamente.');
  } catch (err) {
    console.error('❌ Error inicializando cliente Drive:', err.message);
    return;
  }

  try {
    const rootFolder = await drive.files.get({
      fileId: rootId,
      fields: 'id,name,mimeType',
      supportsAllDrives: true
    });
    console.log(`✓ Carpeta raíz encontrada: "${rootFolder.data.name}" (${rootFolder.data.id})`);
  } catch (err) {
    console.error('❌ Error al acceder a la carpeta raíz en Drive:', err.message);
    if (err.message.includes('invalid_grant')) {
      console.error('👉 CAUSA: El Refresh Token expiró o fue revocado. Se debe generar uno nuevo.');
    } else if (err.code === 404) {
      console.error('👉 CAUSA: La carpeta no existe o la cuenta no tiene permisos sobre ella.');
    }
    return;
  }

  // 3. Probar subida de un archivo de prueba para validar cuota
  console.log('\n3. PRUEBA DE ESCRITURA Y CUOTA EN GOOGLE DRIVE:');
  console.log('-------------------------------------------------------------');
  console.log('Intentando crear un archivo temporal de prueba en Drive...');
  let testFileId = null;
  try {
    const { Readable } = require('stream');
    const testBuffer = Buffer.from('SIAC Drive Probe Test - ' + new Date().toISOString(), 'utf8');
    const res = await drive.files.create({
      requestBody: {
        name: '__probe_test_siac.txt',
        parents: [rootId]
      },
      media: {
        mimeType: 'text/plain',
        body: Readable.from(testBuffer)
      },
      fields: 'id,name',
      supportsAllDrives: true
    });
    testFileId = res.data.id;
    console.log(`✓ Archivo de prueba creado exitosamente! (ID: ${testFileId})`);
    console.log('🟢 LA CUENTA TIENE PERMISOS COMPLETOS DE SUBIDA DE ARCHIVOS (CUOTA ACTIVA).');
  } catch (err) {
    const msg = String(err?.response?.data?.error?.message || err?.message || '');
    console.error('❌ Error subiendo archivo a Drive:', msg);
    if (msg.includes('storage quota') || msg.includes('Service Accounts do not have storage quota')) {
      console.error('\n⚠️ DETECCIÓN EXACTA DEL PROBLEMA:');
      console.error('Google rechazó la subida porque la Cuenta de Servicio NO tiene cuota propia.');
      console.error('Para solucionar esto en el servidor:');
      console.error('1. Configura PLAN_ACTION_GOOGLE_CLIENT_ID, PLAN_ACTION_GOOGLE_CLIENT_SECRET y PLAN_ACTION_GOOGLE_REFRESH_TOKEN en el .env.');
      console.error('2. Reinicia el contenedor backend con: docker compose up -d backend');
    }
  } finally {
    if (testFileId) {
      try {
        await drive.files.delete({ fileId: testFileId, supportsAllDrives: true });
        console.log('✓ Archivo de prueba eliminado limpiamente.');
      } catch (_) {}
    }
  }

  // 4. Diagnóstico de Correo
  console.log('\n4. REVISIÓN DE CONFIGURACIÓN DE CORREO (SMTP):');
  console.log('-------------------------------------------------------------');
  const smtpUser = String(process.env.PLAN_ACTION_SMTP_USER || '').trim();
  const smtpHost = String(process.env.PLAN_ACTION_SMTP_HOST || 'smtp.gmail.com').trim();
  const smtpPort = process.env.PLAN_ACTION_SMTP_PORT || 587;
  const authMethod = String(process.env.PLAN_ACTION_EMAIL_AUTH_METHOD || 'password').trim();

  console.log(`- PLAN_ACTION_SMTP_USER : ${smtpUser ? '✓ ' + smtpUser : '❌ NO DEFINIDO'}`);
  console.log(`- PLAN_ACTION_SMTP_HOST : ${smtpHost}:${smtpPort}`);
  console.log(`- PLAN_ACTION_EMAIL_AUTH_METHOD: ${authMethod}`);

  console.log('\n=============================================================');
  console.log('                 FIN DEL DIAGNÓSTICO');
  console.log('=============================================================\n');
}

runDiagnostic().catch((e) => {
  console.error('Error fatal durante el diagnóstico:', e);
  process.exit(1);
});
