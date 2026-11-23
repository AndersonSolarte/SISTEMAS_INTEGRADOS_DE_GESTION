# Chats privados de planes de acción

Cada conversación se identifica por el plan y las dos cuentas participantes. Compartir un rol o recibir después la responsabilidad de un plan no permite leer conversaciones ajenas.

- El administrador escribe únicamente a Planeación y Efectividad. No tiene selector de líder; el servidor rechaza ese destino también desde clientes antiguos.
- Planeación responde al administrador que participó en esa conversación, dentro del mismo plan.
- El líder conversa con Planeación por un canal separado. Cuando el líder es administrador, las respuestas dirigidas a esa cuenta se conservan en su conversación privada con Planeación; no se copia a otros administradores.
- Los avisos tienen un único destinatario. El correo no incorpora copias; su dirección de respuesta corresponde al remitente. Los enlaces conservan el plan y la conversación.
- Una conversación ya iniciada no cambia de usuario de Planeación por cambios en el orden de las cuentas. Si su destinatario deja de estar activo, el envío se rechaza.
- El filtrado del servidor cubre mensajes, historiales archivados y copias de resúmenes en respuestas JSON. Los clientes no pueden reemplazar estos campos mediante actualizaciones de metadatos.
- Los mensajes históricos sin destinatario verificable se conservan almacenados, pero no se muestran. No se deduce su destinatario a partir del líder actual.

Esta modificación no agrega migraciones de base de datos. El usuario realiza el despliegue con `./deploy.sh`; el asistente no interviene en producción.

## Validación local

Las pruebas de `actionPlanChat*.test.js` del backend cubren permisos, destinatarios, aislamiento por plan y participantes, historiales, metadatos, notificaciones y correos simulados. Las pruebas del frontend verifican la presentación del destinatario y la separación de conversaciones. Las pruebas de correo no realizan envíos reales.
