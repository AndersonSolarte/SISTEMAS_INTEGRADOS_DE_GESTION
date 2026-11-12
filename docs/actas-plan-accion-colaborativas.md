# Borradores compartidos de actas del Plan de Accion

- Se conserva una sola reunion (`pei_meetings`) y su version de acta. No se copia a las actas generales.
- En **Mis actas** aparece el filtro **Actas del Plan de Accion**, con titulo, plan y estado.
- Al crear el borrador o designar un nuevo responsable/corresponsable, se genera una notificacion SIAC por destinatario y acta. Abre el editor compartido, disponible desde el dashboard sin conceder permisos para modificar el plan completo.
- Pueden editar el creador, administrador, Planeacion y Efectividad, y los participantes designados como `principal` o `co_responsible`. Un participante normal no adquiere ese permiso.
- Se autoguarda tras 1,2 segundos; se consultan cambios remotos cada 3 segundos. No hay transmision de cada pulsacion ni combinacion automatica de dos ediciones del mismo texto.
- La version leida se comprueba dentro de una transaccion con bloqueo de fila. Si otra persona guardo primero, se devuelve 409 y se conserva el texto local; el usuario puede copiarlo antes de cargar la version reciente.
- Las actualizaciones remotas no reemplazan un formulario con cambios pendientes. El control tambien se aplica al editor institucional del Plan de Accion.
- Al pasar a firmas o formalizar, el acceso colaborativo queda en consulta. El corresponsable no puede modificar firmantes, roles, firmas ni el estado mediante este acceso.
- Las modificaciones compartidas registran autor, datos previos y nuevos en la auditoria. Se actualiza el contenido de la misma version usada para la firma.
- No cambia la retencion ni las firmas de las actas generales. Las actas del plan conservan su archivo institucional y no reciben la retencion operativa de 30 dias de los formatos generales.

## Validacion local

Backend (incluye inserciones temporales con limpieza posterior, restringidas a PostgreSQL local):

```powershell
$env:RUN_DRAFT_DB_TESTS='1'
node --test --experimental-test-isolation=none backend/src/services/strategicDraftPolicy.test.js
```

Frontend, desde `frontend`:

```powershell
npm test -- --watchAll=false --runInBand --runTestsByPath src/components/meetingMinute/ActionPlanDraftDialog.test.js src/components/meetingMinute/RichTextEditor.test.js
npm run build
```

No requiere nuevas tablas ni migraciones. El despliegue y la publicacion en main se realizan solo por instruccion del usuario.
