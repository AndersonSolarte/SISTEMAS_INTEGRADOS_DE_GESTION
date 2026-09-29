const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { google } = require('googleapis');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const envPath = path.resolve(__dirname, '../../.env');
const clientId = String(process.env.PLAN_ACTION_GOOGLE_CLIENT_ID || '').trim();
const clientSecret = String(process.env.PLAN_ACTION_GOOGLE_CLIENT_SECRET || '').trim();

if (!clientId || !clientSecret) {
  console.error('Error: PLAN_ACTION_GOOGLE_CLIENT_ID o PLAN_ACTION_GOOGLE_CLIENT_SECRET no están definidos en backend/.env');
  process.exit(1);
}

const redirectUri = 'https://developers.google.com/oauthplayground';
const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

const scopes = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/gmail.send'
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: scopes
});

console.log('\n=============================================================');
console.log('       CONFIGURACIÓN DE OAUTH 2.0 PARA GOOGLE DRIVE');
console.log('=============================================================\n');
console.log('Google bloquea subidas de archivos a cuentas de servicio en "Mi Unidad".');
console.log('Para subir los Excel DIR-PE-FR-003 y las Actas oficiales se requiere');
console.log('un Refresh Token permanente de planeacionestrategica@unicesmag.edu.co.\n');
console.log('PASO 1: Copia y abre este enlace en tu navegador:');
console.log('-------------------------------------------------------------');
console.log(authUrl);
console.log('-------------------------------------------------------------\n');
console.log('PASO 2: Inicia sesión con planeacionestrategica@unicesmag.edu.co y permite el acceso.');
console.log('PASO 3: En la pantalla de OAuth Playground, en el Paso 2 (Step 2), presiona:');
console.log('        "Exchange authorization code for tokens"');
console.log('PASO 4: Busca el campo "Refresh token" (empieza con 1//...) y cópialo.\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Pega aquí el Refresh Token (debe comenzar con 1//): ', async (token) => {
  const cleanToken = String(token || '').trim();
  if (!cleanToken.startsWith('1//')) {
    console.error('\n[Error] El token ingresado no es válido. Recuerda copiar el campo "Refresh token" (empieza con 1//) y no el "Access token" (que empieza con ya29).\n');
    rl.close();
    process.exit(1);
  }

  // Validar el token con Google
  console.log('\nValidando token con Google...');
  try {
    const testAuth = new google.auth.OAuth2(clientId, clientSecret);
    testAuth.setCredentials({ refresh_token: cleanToken });
    const drive = google.drive({ version: 'v3', auth: testAuth });
    const res = await drive.files.list({ pageSize: 1 });
    console.log('✓ Token validado exitosamente con Google Drive!');
  } catch (err) {
    console.error('\n[Error al validar con Google]:', err.message);
    rl.close();
    process.exit(1);
  }

  // Guardar en backend/.env
  let envContent = fs.readFileSync(envPath, 'utf8');
  if (envContent.includes('PLAN_ACTION_GOOGLE_REFRESH_TOKEN=')) {
    envContent = envContent.replace(
      /PLAN_ACTION_GOOGLE_REFRESH_TOKEN=.*/,
      `PLAN_ACTION_GOOGLE_REFRESH_TOKEN=${cleanToken}`
    );
  } else {
    envContent += `\nPLAN_ACTION_GOOGLE_REFRESH_TOKEN=${cleanToken}\n`;
  }
  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log('✓ backend/.env actualizado exitosamente con el nuevo Refresh Token.\n');

  rl.close();
  console.log('=============================================================');
  console.log('  ¡Listo! Ahora puedes sincronizar las actas y formatos Excel.');
  console.log('=============================================================\n');
});
