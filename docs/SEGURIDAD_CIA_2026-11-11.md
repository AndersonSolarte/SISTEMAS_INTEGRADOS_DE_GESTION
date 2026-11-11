# Evaluación y fortalecimiento local de seguridad

Evaluación inicial. Los resultados posteriores y las correcciones de compatibilidad
están en [VALIDACION_LOCAL_2026-11-11.md](VALIDACION_LOCAL_2026-11-11.md).

Fecha: 11 de noviembre de 2026. Alcance: código local de autenticación, middleware,
rutas administrativas de respaldo/restauración, tareas de copias y configuración Docker/Nginx.
Es una revisión parcial sustentada en código y pruebas locales, no una certificación
ni una prueba de penetración de todos los módulos. No se accedió a producción.

## Controles existentes observados

- JWT restringido a HS256, secreto obligatorio de al menos 32 caracteres en producción,
  usuario activo y comprobación de identidad/rol contra la base en cada autenticación.
- Permisos específicos para descargar, exportar y restaurar bases. Acciones del monitor
  restringidas a administrador. Descarga y restauración incorporan validación adicional
  de identidad Google y Turnstile en sus controladores.
- Límites de solicitudes y cargas, cabeceras Helmet, política CSP y TLS 1.2/1.3 en Nginx.
- Contenedores con restricciones de privilegios, backend de solo lectura y puertos
  de backend/base publicados en loopback en docker-compose.yml.
- Integrales con manifiesto, validación del catálogo PostgreSQL y SHA-256. Kit privado
  cifrado y copia local por fecha. Siete jornadas recientes verificadas en el informe
  AUDITORIA_RESPALDOS_2026-11-11.md.

Estas observaciones no acreditan que todos los controles estén instalados en producción.

## Cambios implementados localmente

| Dimensión | Hallazgo | Ajuste |
|---|---|---|
| Confidencialidad | express.static publicaba uploads antes de los filtros generales | Filtro específico en ambas rutas de adjuntos; deniega temp, tmp, rutas ocultas, claves, dumps y paquetes de respaldo |
| Confidencialidad | CORS admitía localhost implícitamente en producción y el origen opaco null | Producción exige lista explícita; null se rechaza; solicitudes sin Origin siguen admitidas |
| Confidencialidad | El registro HTTP podía guardar tokens de ruta y parámetros OAuth | Se registra la plantilla de ruta, sin URL ni query string; el bloqueo SQL tampoco registra la URL |
| Confidencialidad e integridad | Adjuntos cacheables y contenido activo servido bajo el origen de la aplicación | no-store, nosniff y CSP sandbox con default-src none en las respuestas estáticas de adjuntos |
| Confidencialidad | Tipos nuevos de respaldo no figuraban en bloqueos HTTP ni exclusiones Git | Bloqueo de siacbackup, enc y sha256; exclusión Git de integrales, kits y backup-kit.key |
| Disponibilidad | Un intento programado fallido impedía repetir la copia del día | Hasta tres intentos totales al día, espera de 15 minutos desde el último fallo, historial persistente y exclusión de ticks concurrentes |
| Integridad y disponibilidad | Descargar sin paquetes recientes podía aparentar éxito | El sincronizador exige integral + kit + huellas válidas de la última jornada esperada antes de aplicar retención |
| Disponibilidad | Descarga local sin reintento configurado | El instalador de tarea configura tres reinicios de la tarea ante fallo, separados por 15 minutos |

La jornada esperada por el sincronizador es hoy desde las 18:35 de Colombia, o ayer
antes de esa hora. Si las copias tardan más, la tarea falla y puede reintentarse.
El instalador debe ejecutarlo el usuario para que la tarea existente reciba su nueva
configuración; no se modificó ninguna tarea de Windows durante esta evaluación.

Los reintentos del backend requieren que esté activo, sin pausa y después de la hora
programada. Se limitan al día corriente: no reconstruyen el estado de días perdidos.
El kit del cron mantiene su programación actual y aún necesita supervisión de fallos.

## Riesgos pendientes y acciones prioritarias

| Prioridad | Dimensión | Evidencia o límite | Acción y criterio de aceptación |
|---|---|---|---|
| Alta | Confidencialidad | database.dump y uploads del integral no tienen cifrado propio; SCP protege el transporte, no el archivo almacenado | Cifrar el integral con formato autenticado y claves independientes, adaptar restauración y recuperación, y demostrar restauración con clave y rechazo de alteraciones. Mientras tanto, comprobar cifrado de disco y permisos reales del servidor/equipo |
| Alta | Confidencialidad | Adjuntos ordinarios siguen accesibles por URL conocida; no hay autenticación en express.static | Inventariar por módulo qué es público y privado; migrar privados a descarga autenticada con autorización por registro y enlaces temporales cuando proceda. Probar acceso anónimo y entre usuarios de distintos permisos |
| Alta | Integridad | SHA-256 junto al archivo detecta daños, pero un atacante con escritura puede reemplazar ambos; el kit usa AES-CBC sin autenticación propia | Migrar kit y copias a cifrado autenticado o firmas verificadas con clave fuera del almacenamiento de copias. Conservar compatibilidad de lectura de kits existentes |
| Alta | Disponibilidad | El backend tiene acceso de escritura a su carpeta de respaldos | Añadir segunda copia con credenciales separadas, retención inmutable o desconexión física; comprobar que la cuenta del aplicativo no pueda borrarla |
| Alta | Disponibilidad | No se completó una recuperación aislada de código, configuración, base y adjuntos | Ejecutar simulacro en entorno separado, medir recuperación, verificar módulos/documentos y conservar acta; repetir tras cambios importantes |
| Alta | Cobertura | Archivos solo en Drive, bases externas y nuevos volúmenes no se incluyen automáticamente | Inventario de activos y responsables; respaldos independientes y conciliación de archivos enlazados |
| Media | Integridad | DB y adjuntos se capturan en momentos sucesivos | Coordinar escrituras o instantáneas para consistencia y registrar el commit desplegado exacto |
| Media | Acceso | Verificación de sesión se basa en id, email, rol y estado, no en contador de revocación persistente | Evaluar token_version incrementable, cierre global de sesiones y MFA institucional para administradores; comprobar revocación efectiva de tokens ya emitidos |
| Media | Detección | El fallo de cobertura queda en salida/código de tarea; no hay nueva notificación externa | Integrar alertas institucionales de copia ausente, disco lleno, errores repetidos y acceso administrativo inusual, sin incluir secretos |
| Media | Continuidad | No se midieron objetivos de recuperación | Acordar RPO y RTO. Un respaldo diario implica una pérdida potencial cercana a 24 horas si funciona; fallos o copias inaccesibles amplían esa ventana. Si se requiere menos, evaluar archivado WAL/PITR |
| Media | Mantenimiento | No se consultaron vulnerabilidades actuales de todas las dependencias ni se validó el servidor | Auditar lockfiles y dependencias Python con fuentes actualizadas, priorizar vulnerabilidades explotables y probar actualizaciones; validar cabeceras efectivas, permisos, firewall y registros |

Antes de exigir autenticación en todos los adjuntos hay que adaptar las pantallas que usan
URLs directas y los enlaces públicos legítimos. El filtro implementado protege temporales
y tipos sensibles; no sustituye autorización por documento. CSP sandbox puede limitar
documentos activos (HTML/SVG): revisar las vistas que necesiten esos formatos en pruebas
de aceptación. CORS tampoco sustituye autenticación o autorización.

No se rotaron claves ni se cambió el formato de cifrado existente sin una ruta de
recuperación validada. El cambio de formato debe incluir migración y compatibilidad.

## Validación y límites

- 14 pruebas Node aprobadas: controles nuevos y regresiones de solicitudes, firmas y OAuth,
  más decisiones de reintento (espera, reinicio, ejecución activa, éxito y límite).
- Sintaxis JavaScript comprobada y los tres scripts PowerShell analizados sin errores.
- Verificador local probado anteriormente con siete jornadas completas (código 0)
  y jornada ausente (código 1).
- No se ejecutó el sincronizador: establece conexiones SSH prohibidas en esta sesión.
- No se reinició el aplicativo, ejecutaron migraciones ni alteraron datos o respaldos reales.
- No se validó Nginx en ejecución: no se dispone de nginx ni Docker en PATH en esta sesión.
  No se ejecutó compilación React porque no se modificaron componentes o dependencias.
- La aplicación de los ajustes al servidor y la instalación de la tarea son manuales
  por el usuario. Los scripts locales modificados aún no están instalados allí.

## Referencias

- OWASP, seguridad de bases de datos y protección de respaldos:
  https://cheatsheetseries.owasp.org/cheatsheets/Database_Security_Cheat_Sheet.html
- OWASP, almacenamiento criptográfico y cifrado autenticado:
  https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html
- CISA, guía contra ransomware: copias cifradas, desconectadas y pruebas de recuperación:
  https://www.cisa.gov/sites/default/files/2023-10/StopRansomware-Guide-508C-v3_1.pdf
