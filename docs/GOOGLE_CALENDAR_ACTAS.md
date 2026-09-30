# Google Calendar para actas de reunión

La integración utiliza autorización OAuth individual. Cada Responsable Principal conecta una vez su cuenta institucional y SIAC conserva el `refresh token` cifrado para consultar disponibilidad y crear o actualizar la siguiente reunión en su calendario.

No requiere delegación de todo el dominio. La programación se almacena separada del acta y no se incluye en el PDF, Word ni proceso de firmas.

## 1. Google Calendar API

1. Abra [Google Calendar API](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com?project=sig-cesmag-490522).
2. Confirme que el proyecto sea `SIG-CESMAG`.
3. Confirme que el estado sea **Habilitada**.

## 2. Configurar la aplicación OAuth

1. Abra [Google Auth Platform](https://console.cloud.google.com/auth/overview?project=sig-cesmag-490522).
2. En **Público objetivo**, seleccione **Interno** si la consola permite esa opción para la organización `unicesmag.edu.co`.
3. Complete la información básica de la aplicación con el nombre `SIAC Calendar` y un correo institucional de soporte.
4. En **Acceso a los datos**, confirme los permisos de identidad y Calendar solicitados por la aplicación.

Permisos utilizados:

```text
openid
email
https://www.googleapis.com/auth/calendar.events
https://www.googleapis.com/auth/calendar.freebusy
```

## 3. Crear el cliente OAuth web

1. Abra [Google Auth Platform > Clientes](https://console.cloud.google.com/auth/clients?project=sig-cesmag-490522).
2. Pulse **Crear cliente**.
3. Tipo: **Aplicación web**.
4. Nombre: `SIAC Calendar Web`.
5. Agregue como origen autorizado:

```text
https://planeaciongp.unicesmag.edu.co
```

6. Agregue como URI de redireccionamiento autorizado:

```text
https://planeaciongp.unicesmag.edu.co/api/meeting-minutes/calendar-connection/callback
```

7. Cree el cliente y copie su **ID de cliente** y **secreto del cliente**. El secreto solamente se guarda en el `.env` del servidor.

Para desarrollo local se puede agregar además:

```text
http://localhost:3000
http://localhost:5000/api/meeting-minutes/calendar-connection/callback
```

## 4. Variables del servidor

En el `.env` ubicado en la raíz del proyecto configure:

```env
MEETING_CALENDAR_OAUTH_CLIENT_ID=ID_DEL_CLIENTE.apps.googleusercontent.com
MEETING_CALENDAR_OAUTH_CLIENT_SECRET=SECRETO_DEL_CLIENTE
MEETING_CALENDAR_OAUTH_REDIRECT_URI=https://planeaciongp.unicesmag.edu.co/api/meeting-minutes/calendar-connection/callback
MEETING_CALENDAR_ALLOWED_DOMAIN=unicesmag.edu.co
MEETING_CALENDAR_TIMEZONE=America/Bogota
```

No publique el secreto ni lo agregue a Git.

## 5. Uso y verificación

1. Despliegue y abra un acta guardada con la cuenta del Responsable Principal.
2. Pulse **Conectar mi Calendar**.
3. Autorice exactamente el correo institucional que aparece registrado en el acta.
4. Regrese a SIAC y confirme el estado **Calendar conectado**.
5. Seleccione fecha y horario, consulte disponibilidad y programe la reunión.

Si la política institucional impide que los usuarios autoricen aplicaciones OAuth, Google mostrará un bloqueo administrativo. Esa política solamente puede cambiarla un administrador de Workspace; SIAC no puede omitirla.

Referencias oficiales:

- https://developers.google.com/workspace/guides/create-credentials
- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query
- https://developers.google.com/workspace/calendar/api/v3/reference/events/insert
