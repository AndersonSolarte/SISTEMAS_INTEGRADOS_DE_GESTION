# Plataforma de Planeación Estratégica Institucional

La nueva plataforma está aislada del modelo legado `plan_accion`. Sus tablas utilizan el prefijo `pei_` y la API se publica bajo `/api/strategic-planning`.

## Configuración inicial

Al iniciar el backend se sincroniza el esquema y se crea, si aún no existe, el PED 2022–2029 con sus vigencias, dos niveles iniciales, periodos S1/S2, instrumento versión 1 y workflow parametrizable. Los futuros PED, niveles y periodos no requieren cambios de código.

Variables relevantes:

- `SIAC_PEI_TEMP_DIR`: ruta privada temporal. Por defecto usa `uploads/.private/strategic-planning`, incluida en la copia integral pero no publicada por Express.
- `SIAC_PEI_MAX_UPLOAD_BYTES`: máximo por evidencia/importación; 25 MB por defecto.
- `SIAC_PEI_DRIVE_ROOT_ID`: ID de la carpeta o Unidad Compartida raíz autorizada a la cuenta institucional.
- `SIAC_PEI_SYNC_WORKER_ENABLED`: habilita el trabajador persistente; `true` por defecto.
- `SIAC_PEI_SYNC_INTERVAL_MS`: intervalo del trabajador; 30 segundos por defecto.
- `FRONTEND_URL`: origen utilizado en enlaces de firma.
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` y `GOOGLE_PRIVATE_KEY`, o `GOOGLE_SERVICE_ACCOUNT_JSON` / `GOOGLE_SERVICE_ACCOUNT_FILE`: credenciales con acceso delegado a Drive. Nunca se guarda la contraseña del correo institucional.

La cuenta usada debe tener acceso a la Unidad Compartida administrada por `planeacionestrategica@unicesmag.edu.co`. Para “Mi unidad” debe configurarse OAuth institucional antes de activar sincronización productiva.

## Retención y cierre

Las evidencias permanecen en el servidor durante toda la vigencia anual, no solamente 30 días. El endpoint de cierre ejecuta primero una conciliación y rechaza el cierre mientras exista evidencia pendiente o fallida. Incluso con cierre satisfactorio, la API no borra directamente: devuelve autorización de limpieza para que una tarea administrativa posterior verifique manifiesto, IDs y huellas antes de eliminar copias locales.

## Drive

La estructura creada es corta: `PED / vigencia / PA-dependencia / EVID-periodo`. Las carpetas y archivos llevan `appProperties` con IDs SIAC, y sus IDs de Drive se guardan en PostgreSQL. Esto hace que los reintentos sean idempotentes y que la búsqueda no dependa solo del nombre.

## Firma de actas

Cada publicación congela una versión y genera un token aleatorio almacenado únicamente como hash. Los externos validan un OTP de seis dígitos enviado por correo, con vencimiento de diez minutos y límite de intentos. La imagen de firma queda en almacenamiento privado. Cada firma guarda la huella del contenido, IP, agente, método y fecha; se presenta como firma electrónica con trazabilidad SIAC, no como firma digital certificada.

## Importaciones

El importador histórico incluye el mapeo inicial de `DIR-PE-FR-003` versión 5 y separa vista previa de confirmación transaccional. El importador presupuestal crea movimientos; nunca reemplaza el presupuesto inicial. Los mapeos de 2023–2025 se almacenan con cada lote cuando se reciban los formatos históricos.

## Catálogos y responsables

Las tablas de referencia del PED se administran como catálogos en base de datos. Dependencias, cargos, actores, macroactividades, lugares y estados pueden agregarse, editarse, desactivarse y reactivarse sin cambiar el código. La desactivación es lógica para no romper planes históricos.

El archivo `TABLAS DE REFERENCIA (2).xlsx` fue cargado para el PED 2022–2029. Sus 68 responsables coincidieron con usuarios activos de SIAC y quedaron relacionados con nombre, correo, dependencia y cargo. Los objetivos y lineamientos se incorporaron como elementos de la estructura estratégica.

Cada Plan de Acción conserva tres vínculos: dependencia propietaria, cargo responsable y usuario líder. Al transferir el liderazgo se cierra la asignación anterior y se registra la nueva con fecha, motivo, usuario que realizó el cambio y relación con su predecesora. El plan no pierde su dependencia ni el histórico cuando una persona cambia de cargo, pasa a otra dependencia o deja de ser líder.
