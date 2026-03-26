# Despliegue Docker

## Servicios incluidos

- `frontend`: React compilado y servido con Nginx
- `backend`: API Node/Express
- `db`: PostgreSQL opcional solo si se quiere una base dentro de Docker
- `python-service`: analitica complementaria de Saber Pro

## Modo actual recomendado

Este proyecto esta configurado para usar:

- app en Docker (`frontend`, `backend`, `python-service`)
- base de datos local PostgreSQL 18 fuera de Docker

Valores actuales relevantes en `.env`:

- `HOST_DB_HOST=host.docker.internal`
- `HOST_DB_PORT=5432`
- `FRONTEND_PORT_HOST=8081`
- `BACKEND_PORT_HOST=5001`
- `PUBLIC_APP_URL=http://localhost:8081`

## Preparacion

1. Copiar variables:

```bash
cp .env.docker.example .env
```

2. Ajustar valores reales en `.env`:

- `DB_PASSWORD`
- `JWT_SECRET`
- `PUBLIC_APP_URL`
- `GOOGLE_CLIENT_ID`
- `SMTP_*`
- `HOST_DB_HOST`
- `HOST_DB_PORT`

3. Si se usara Google Sheets o cuenta de servicio:

- colocar el JSON en `backend/keys/google-service-account.json`

## Levantar ambiente

Para el modo actual con PostgreSQL local:

```bash
docker compose up -d --build
```

Si en algun momento se quiere usar la base dentro de Docker, levantar tambien el perfil `docker-db`:

```bash
docker compose --profile docker-db up -d --build
```

## Ejecutar migraciones

```bash
docker compose exec backend npm run migrate
```

## Ver logs

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f python-service
```

## URLs actuales

- Frontend: `http://localhost:8081`
- Backend health: `http://localhost:5001/api/health`
- PostgreSQL local usado por la app: `localhost:5432`

## Persistencia

- Base de datos principal: PostgreSQL 18 local del equipo
- Base Docker opcional: volumen `postgres_data`
- Archivos cargados: volumen `backend_uploads`

## Recomendaciones para nube

- publicar solo `80/443` hacia el exterior
- restringir `22`, `5000` y `5433` a VPN o red privada
- usar proxy/reverse proxy con TLS
- respaldar volumen de base de datos y `backend_uploads`
