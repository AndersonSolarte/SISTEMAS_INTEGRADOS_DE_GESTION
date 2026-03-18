# Fusion de bases sin perder datos + clonacion funcional en trabajo

## 1) Objetivo
- Unificar:
  - Tu base actual local (equipo actual).
  - Backup del trabajo: `backups/sgc_db_20260227_163955.sql`.
- Mantener todo lo existente y, cuando hay choque de la misma entidad, conservar la version mas reciente.

## 2) Estrategia segura (obligatoria)
No sobrescribas `sgc_db` directo. Usa bases temporales:

- `sgc_local_raw` = copia de tu base actual.
- `sgc_work_raw` = restauracion del backup trabajo.
- `sgc_merge` = base final unificada.

## 3) Pasos SQL (PostgreSQL)
> Si `psql` no esta en PATH, usa la ruta completa del binario de PostgreSQL.

1. Crear backups de seguridad de hoy:
```powershell
pg_dump -h localhost -p 5433 -U postgres -d sgc_db -F p -f backups\sgc_db_local_pre_merge.sql
```

2. Crear bases temporales:
```sql
CREATE DATABASE sgc_local_raw;
CREATE DATABASE sgc_work_raw;
CREATE DATABASE sgc_merge;
```

3. Cargar datos:
- `sgc_local_raw`: restaura `sgc_db_local_pre_merge.sql`
- `sgc_work_raw`: restaura `backups/sgc_db_20260227_163955.sql`
- `sgc_merge`: inicia como copia de `sgc_local_raw`

4. Ejecutar script de fusion en `sgc_merge`:
- Archivo: `scripts/sql/01_merge_work_into_local.sql`
- Antes de ejecutar, cambia `CAMBIAR_PASSWORD` en el script por tu clave PostgreSQL.

5. Validar conteos y muestras funcionales (login, documentos, busqueda, favoritos).

6. Cuando todo este OK, en `backend/.env` deja:
```env
DB_NAME=sgc_merge
```

## 4) Regla de merge usada
- Catalogos (macro/proceso/subproceso/tipos): inserta faltantes por nombre.
- Usuarios: clave `email`, actualiza si la fila del trabajo es mas reciente.
- Documentos: clave `codigo`, actualiza si la fila del trabajo es mas reciente.
- Permisos y favoritos: fusion por usuario + modulo/documento.
- Datos masivos: agrega filas no existentes exactas (sin borrar informacion).

## 5) Para que al clonar en trabajo salga TODO actualizado

## 5.1 Git correcto
```powershell
git fetch --all --prune
git checkout <tu-rama-principal>
git pull origin <tu-rama-principal>
git log -1 --oneline
```

## 5.2 Variables de entorno (sin esto no levanta igual)
- Copiar y completar:
  - `backend/.env`
  - `frontend/.env`
- Verifica que estos 2 sean iguales:
  - `backend: GOOGLE_CLIENT_ID`
  - `frontend: REACT_APP_GOOGLE_CLIENT_ID`

- Verifica archivo obligatorio:
  - `backend/keys/google-service-account.json`

## 5.3 Dependencias y arranque
```powershell
# backend
cd backend
npm ci
npm run migrate
npm run seed
npm run dev

# frontend (nueva terminal)
cd frontend
npm ci
npm start
```

## 5.4 Checks finales
- Login Google institucional funcional.
- Sincronizacion desde Google Sheets funcional.
- Modulos visibles con los nombres nuevos.
- Busqueda de documentos devuelve datos esperados.

## 6) Recomendacion critica
- No subas `.env` ni `keys/google-service-account.json` al repo.
- Rota credenciales expuestas (SMTP/JWT/DB) antes de produccion.
