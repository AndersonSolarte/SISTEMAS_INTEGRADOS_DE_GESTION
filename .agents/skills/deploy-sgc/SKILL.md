---
name: deploy-sgc
description: Guía de despliegue del Sistema de Gestión de Calidad en el servidor de producción (SOLO DOCUMENTACIÓN - EJECUTADO EXCLUSIVAMENTE POR EL USUARIO)
---

# Despliegue del SGC en Producción

> [!CAUTION]
> **REGLA CRÍTICA ESTRICTA PARA EL ASISTENTE DE IA:**
> **EL AGENTE NUNCA DEBE CONECTARSE POR SSH NI EJECUTAR DESPLIEGUES O COMANDOS EN EL SERVIDOR DE PRODUCCIÓN.**
> El asistente solo debe subir cambios a la rama `main` cuando el usuario lo solicite expresamente.
> El despliegue en el servidor es una tarea **100% manual y exclusiva del usuario**.

---

## Procedimiento Manual del Usuario

El usuario es el único autorizado para ingresar al servidor de producción y ejecutar el despliegue.

### Comandos que ejecuta el usuario en el servidor:
```bash
cd /var/www/SISTEMAS_INTEGRADOS_DE_GESTION && ./deploy.sh
```

### Contenido del script `./deploy.sh`:
1. Ir al directorio del proyecto: `/var/www/SISTEMAS_INTEGRADOS_DE_GESTION`
2. Cambiar a la rama de producción: `git checkout main`
3. Descargar la última versión de GitHub: `git pull origin main`
4. Reconstruir e iniciar contenedores Docker: `docker compose up -d --build`
5. Ejecutar migraciones pendientes: `docker compose exec -T backend npm run migrate`
