# Desarrollo Local

Este proyecto queda separado en dos entornos:

- `docker-compose.yml`: servidor / produccion
- `docker-compose.local.yml`: apoyo local para base de datos y servicio Python

No reutilices certificados, `.env` ni archivos del servidor en local.

## 1. Archivos locales

Copia estas plantillas y completa tus valores:

```powershell
Copy-Item .env.local.example .env.local
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

### Valores recomendados

En `backend/.env`:

```env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5433
DB_NAME=sgc_merge
DB_USER=postgres
DB_PASSWORD=CAMBIAR_DB_PASSWORD

JWT_SECRET=CAMBIAR_JWT_SECRET
JWT_EXPIRE=7d

FRONTEND_URL=http://localhost:3000

GOOGLE_CLIENT_ID=580702732199-jmeutruntu92d4blhvq28gdfqlucml3p.apps.googleusercontent.com
INSTITUTIONAL_EMAIL_DOMAIN=unicesmag.edu.co
AUTH_GOOGLE_ONLY=true

GOOGLE_SHEETS_ID=
GOOGLE_SHEETS_TAB=
GOOGLE_SERVICE_ACCOUNT_JSON=keys/google-service-account.json

SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="Sistema SIG <no-reply@dominio.com>"
```

En `frontend/.env`:

```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_NAME=Sistema de Gestion de Calidad
REACT_APP_VERSION=1.0.0
REACT_APP_GOOGLE_CLIENT_ID=580702732199-jmeutruntu92d4blhvq28gdfqlucml3p.apps.googleusercontent.com
```

## 2. Servicios locales

Levanta base de datos y servicio Python:

```powershell
docker compose --env-file .env.local -f docker-compose.local.yml up -d --build
```

## 3. Backend local

```powershell
cd backend
npm install
npm run dev
```

## 4. Frontend local

En otra terminal:

```powershell
cd frontend
npm install
npm start
```

Abre:

```text
http://localhost:3000
```

## 5. Requisitos para que local funcione

- Debe existir `backend/keys/google-service-account.json` si vas a usar integraciones de Google Sheets.
- Google Cloud debe tener autorizado `http://localhost:3000` como JavaScript origin.
- Si vas a probar login, usa el mismo `GOOGLE_CLIENT_ID` del entorno correcto.

## 6. Flujo seguro para subir a servidor

1. Crear una rama por cambio.
2. Probar en local.
3. Ejecutar `npm run build` en `frontend`.
4. Validar backend con el comando que aplique, por ejemplo `node --check`.
5. Hacer commit pequeno y claro.
6. Hacer push.
7. En servidor: `git pull origin main`.
8. Reconstruir solo los servicios afectados.
9. Probar inmediatamente el flujo tocado.

## 7. Regla de oro

Estos archivos no deben subirse a Git:

- `.env`
- `backend/.env`
- `frontend/.env`
- certificados `.pem` / `.key`
- `fullchain.pem`
- llaves reales en `backend/keys`

Git solo debe guardar plantillas y codigo.
