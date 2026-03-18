# Despliegue Docker

## Servicios incluidos

- `frontend`: React compilado y servido con Nginx
- `backend`: API Node/Express
- `db`: PostgreSQL
- `python-service`: analitica complementaria de Saber Pro

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

3. Si se usara Google Sheets o cuenta de servicio:

- colocar el JSON en `backend/keys/google-service-account.json`

## Levantar ambiente

```bash
docker compose up -d --build
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

## URLs por defecto

- Frontend: `http://localhost:8080`
- Backend health: `http://localhost:5000/api/health`
- PostgreSQL host local: `localhost:5433`

## Persistencia

- Base de datos: volumen `postgres_data`
- Archivos cargados: volumen `backend_uploads`

## Recomendaciones para nube

- publicar solo `80/443` hacia el exterior
- restringir `22`, `5000` y `5433` a VPN o red privada
- usar proxy/reverse proxy con TLS
- respaldar volumen de base de datos y `backend_uploads`
