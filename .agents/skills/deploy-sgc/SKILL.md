---
name: deploy-sgc
description: Desplegar el Sistema de Gestión de Calidad en el servidor de producción
---

# Despliegue del SGC en Producción

Este skill automatiza y documenta el procedimiento para desplegar la última versión del Sistema de Gestión de Calidad (SGC) en el servidor de producción Linux.

## Comandos del Despliegue

Para desplegar los últimos cambios, conéctate al servidor vía SSH y ejecuta el script de despliegue en la raíz del proyecto:

```bash
cd /var/www/SISTEMAS_INTEGRADOS_DE_GESTION && ./deploy.sh
```

## Contenido del script `./deploy.sh`
El script ejecuta los siguientes pasos secuenciales:
1. Cambia al directorio del proyecto: `/var/www/SISTEMAS_INTEGRADOS_DE_GESTION`
2. Cambia a la rama de producción: `git checkout main`
3. Descarga la última versión: `git pull origin main`
4. Compila y reinicia los contenedores de Docker: `docker compose up -d --build`
5. Ejecuta las migraciones de base de datos pendientes: `docker compose exec -T backend npm run migrate`
