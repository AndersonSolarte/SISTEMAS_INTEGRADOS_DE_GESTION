# Reglas de Comportamiento y Autonomía para Antigravity

## 1. Modo Autónomo en Desarrollo Local
- **Ejecución directa sin preguntas intermedias**: Ante cualquier requerimiento del usuario, implementa los cambios en backend y frontend, ejecuta compilaciones, pruebas locales y reinicios necesarios de forma 100% autónoma.
- **Entrega orientada al resultado final**: No pauses para pedir confirmación sobre pasos intermedios ni hagas preguntas de trámite. Valida que todo funcione y entrega el resultado final ya listo y probado.

## 2. Reglas Estrictas de Servidor y Git
- **PROHIBIDO tocar el Servidor de Producción**: NUNCA intentar conectarse por SSH, ni ejecutar comandos, scripts (`./deploy.sh`) o migraciones en el servidor de producción. El despliegue en producción es potestad 100% manual y exclusiva del usuario.
- **Control de subidas a Git (`origin/main`)**: Solo realizar `git push origin main` cuando el usuario lo solicite o cuando la tarea esté terminada y requiera despliegue.
