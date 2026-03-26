# Despliegue en Ubuntu 24.04

## Objetivo

Desplegar la aplicacion en un servidor Ubuntu con:

- `frontend`, `backend`, `python-service` en Docker
- `db` PostgreSQL en Docker en el mismo servidor

## Requisitos

- Acceso SSH por usuario y contrasena
- Docker y Docker Compose disponibles
- Codigo del proyecto en el servidor

## Preparar variables

1. Copiar el ejemplo de servidor:

```bash
cp .env.server.example .env
```

2. Ajustar al menos:

- `PUBLIC_APP_URL`
- `DB_PASSWORD`
- `JWT_SECRET`
- `GOOGLE_CLIENT_ID`
- `SMTP_*`

Para despliegue con base en Docker del mismo servidor debe quedar:

- `HOST_DB_HOST=db`
- `HOST_DB_PORT=5432`

## Levantar servicios

```bash
docker compose --profile docker-db up -d --build
```

## Ejecutar migraciones

```bash
docker compose exec backend npm run migrate
```

## Verificacion

```bash
docker compose ps
curl http://localhost:5001/api/health
curl http://localhost:8080
```

## Migrar base de datos existente

Si la base actual esta fuera de Docker, una ruta segura es:

1. exportar respaldo desde PostgreSQL origen
2. levantar `db` en Docker
3. restaurar el respaldo en `sgc_db`
4. ejecutar migraciones del backend
5. validar login y consultas principales

Ejemplo de restauracion:

```bash
docker cp respaldo.dump sgc-db:/tmp/respaldo.dump
docker compose exec db pg_restore -U postgres -d sgc_db /tmp/respaldo.dump
```

Si el respaldo es `.sql`:

```bash
docker cp respaldo.sql sgc-db:/tmp/respaldo.sql
docker compose exec -T db psql -U postgres -d sgc_db < respaldo.sql
```

## Puertos

- `22`: SSH
- `8080`: frontend
- `5001`: backend
- `5433`: PostgreSQL expuesto al host solo si se necesita administracion remota

## Recomendacion

En produccion conviene publicar solo `80/443` con un proxy reverso y dejar `5001` y `5433` cerrados a internet.
