# Google Calendar para actas de reunión

Esta integración permite que el Responsable Principal programe una siguiente reunión desde SIAC. El evento se crea en el calendario principal del responsable, consulta disponibilidad y envía invitaciones a participantes del acta o invitados adicionales.

La programación se guarda separada del acta y no se incluye en el PDF, Word ni proceso de firmas.

## 1. Habilitar Google Calendar API

En el proyecto institucional de Google Cloud:

1. Abra [Google Cloud Console](https://console.cloud.google.com/) y seleccione el proyecto institucional.
2. Entre directamente a [Google Calendar API](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com).
3. Confirme que aparece el proyecto correcto en la barra superior.
4. Pulse **Habilitar**.

## 2. Preparar la cuenta de servicio

1. Abra [IAM y administración > Cuentas de servicio](https://console.cloud.google.com/iam-admin/serviceaccounts).
2. Cree o reutilice una cuenta de servicio institucional.
3. Active **Delegación de todo el dominio de Google Workspace**.
4. Abra **Claves > Agregar clave > Crear clave nueva > JSON**.
5. Guárdela fuera del control de versiones, en `backend/keys/google-calendar-service-account.json`.
6. Copie el **ID numérico del cliente** de la cuenta de servicio; no use su correo en el siguiente paso.

## 3. Autorizar en Google Workspace

Un superadministrador debe abrir [Delegación de todo el dominio](https://admin.google.com/ac/owl/domainwidedelegation), o navegar por:

**Consola de administración > Seguridad > Controles de API > Delegación de todo el dominio > Añadir nuevo**

Registre el ID numérico del cliente y estos permisos, separados por coma:

```text
https://www.googleapis.com/auth/calendar.events,https://www.googleapis.com/auth/calendar.freebusy
```

La delegación permite que SIAC cree el evento en nombre del Responsable Principal. SIAC no solicita ni almacena la contraseña del responsable.

## 4. Variables del servidor

En el servidor, configure estas variables en el archivo `.env` ubicado en la raíz del proyecto:

```env
MEETING_CALENDAR_SERVICE_ACCOUNT_JSON=/app/keys/google-calendar-service-account.json
MEETING_CALENDAR_ALLOWED_DOMAIN=unicesmag.edu.co
MEETING_CALENDAR_TIMEZONE=America/Bogota
```

El archivo indicado puede ser el mismo de `GOOGLE_SERVICE_ACCOUNT_JSON` si esa cuenta tiene delegación y los permisos anteriores.

## 5. Verificación

1. Reinicie el backend o ejecute el despliegue.
2. Abra un acta guardada con la cuenta de su Responsable Principal.
3. En **Programar siguiente reunión**, seleccione fecha y horas.
4. Pulse **Consultar disponibilidad**.
5. Programe el evento y confirme que el organizador mostrado en Google Calendar sea el Responsable Principal.

Si aparece un error de autorización, revise que:

- se utilizó el ID numérico del cliente en la consola de administración;
- ambos permisos fueron autorizados;
- el correo del Responsable Principal pertenece al dominio configurado;
- la cuenta de servicio tiene activada la delegación del dominio;
- la política de Calendar del dominio permite consultar libre/ocupado entre usuarios.

La propagación inicial de la autorización de Google Workspace puede tardar algunos minutos.

Referencias oficiales:

- https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query
- https://developers.google.com/workspace/calendar/api/v3/reference/events/insert
- https://developers.google.com/identity/protocols/oauth2/service-account
