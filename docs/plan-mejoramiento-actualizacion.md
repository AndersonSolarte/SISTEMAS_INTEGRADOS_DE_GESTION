# Actualización de Plan de Mejoramiento

El usuario realiza el despliegue habitual con `./deploy.sh`. Las migraciones crean
`institutional_policies` y cargan las 13 políticas y 75 líneas distintas de
`POliticas_BD.xlsx` si el catálogo está vacío. Si ya existen políticas en el servidor,
se conservan; se pueden incorporar las del archivo mediante “Actualizar políticas”.

El catálogo inicial reproducible está en
`backend/src/data/institutionalPolicies.json`. Las altas posteriores desde la interfaz
se guardan en PostgreSQL; el JSON no sustituye los cambios del usuario.

Los tres indicadores de cada actividad se guardan en el contenido JSON existente
del plan. No requieren columnas adicionales. La hoja `INDICADORES` conserva los tres
textos al exportar e importar Excel y admite el formato anterior.

La integración de Drive reutiliza la conexión de Plan de Acción si no hay una
configuración propia de Mejoramiento. Las credenciales no se incluyen en Git.

La reparación de vínculos duplicados es independiente de las migraciones:
`node src/scripts/consolidateImprovementLinks.js` solo informa qué consolidaría.
La opción `--apply` crea un respaldo local y aplica los cambios en una transacción.
No se ejecuta automáticamente durante el despliegue.
