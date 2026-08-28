#!/bin/bash
# Script de despliegue automático para el Sistema de Gestión de Calidad (SGC)
# Asegura que el script falle inmediatamente si algún comando interno falla
set -e

TARGET_DIR="/var/www/SISTEMAS_INTEGRADOS_DE_GESTION"

echo "========================================="
echo "  Iniciando despliegue de SGC en: $TARGET_DIR"
echo "========================================="

# 1. Navegar al directorio de producción
cd "$TARGET_DIR"

# 2. Asegurar la rama principal
echo ">> Cambiando a la rama main..."
git checkout main

# 3. Descargar últimos cambios
echo ">> Descargando actualizaciones desde GitHub..."
git checkout -- .
git pull origin main

# 4. Recompilar e iniciar contenedores
echo ">> Deteniendo y limpiando contenedores previos..."
docker compose down --remove-orphans || true

echo ">> Recompilando y levantando contenedores con Docker Compose..."
docker compose up -d --build

# 5. Ejecutar migraciones
echo ">> Ejecutando migraciones de base de datos..."
docker compose exec -T backend npm run migrate

echo "========================================="
echo "  ¡Despliegue completado con éxito!      "
echo "========================================="
