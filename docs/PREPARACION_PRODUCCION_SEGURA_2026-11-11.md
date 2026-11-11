# Preparación de seguridad para producción

Fecha: 11 de noviembre de 2026. Rama local: main. No se ejecutó despliegue ni push.
Este informe actualiza la evaluación inicial de SEGURIDAD_CIA_2026-11-11.md.
La validación funcional posterior y sus correcciones constan en
[VALIDACION_LOCAL_2026-11-11.md](VALIDACION_LOCAL_2026-11-11.md).

## Resultado y límites para decidir el despliegue

Los cambios de refuerzo están implementados y probados localmente. No se declara
ausencia total de vulnerabilidades ni se certifica la instalación de producción.

| Comprobación | Resultado |
|---|---|
| Backend, pruebas completas | 378 aprobadas con Node 24 y dos regresiones de seguridad adicionales aprobadas |
| Frontend, pruebas completas | 128 aprobadas en 34 suites, también con Node 24 |
| Python, pruebas de limpieza | 4 aprobadas |
| Frontend, compilación optimizada | Aprobada; conserva advertencias de lint anteriores |
| Archivos del build | Sin mapas ni archivos privados de los tipos comprobados |
| Comparación del build con secretos locales | Sin coincidencias contra 8 valores privados de archivos de entorno locales; nunca se imprimieron los valores |
| Lista de variables públicas | Una variable privada de prueba fue rechazada antes de compilar |
| Auditoría npm conectada del backend | 0 avisos conocidos después de correcciones |
| Auditoría npm conectada de dependencias de producción del frontend | 0 avisos conocidos |
| Auditoría Python 3.11, dependencias directas y transitivas resueltas | 0 avisos conocidos después de correcciones |
| FastAPI actualizado | /health responde 200; /docs, /redoc y /openapi.json responden 404 en modo producción |
| Escaneo actual de archivos de entrega | Sin hallazgos por las reglas del verificador local |
| Gitleaks, historial Git con --all | 1.074 commits examinados; 3 coincidencias revisadas: identificadores de pruebas y almacenamiento local, no credenciales |
| Docker/Nginx | Compose y Nginx 1.30.6 portátil validados, con HTTPS y navegador; falta construir/ejecutar contenedores Linux |

La auditoría completa del frontend **mantiene 19 avisos en herramientas de desarrollo**:
12 bajos, 1 moderado y 6 altos. Incluyen dependencias de react-scripts, SVGO y el servidor
de desarrollo. No se ocultan con excepciones del auditor. Clasificar react-scripts y
Testing Library como dependencias de desarrollo refleja su uso, pero no corrige esos
avisos. La imagen final solo recibe el build estático y no contiene node_modules ni
el servidor de desarrollo. No se debe publicar `npm start` como servicio de producción.

Si la condición de aprobación es cero avisos en **todo** el árbol, esta entrega todavía
no cumple esa condición: falta sustituir o actualizar la cadena de compilación antigua
con pruebas de compatibilidad. No se aplicó `npm audit fix --force`, que proponía
react-scripts@0.0.0 y podía inutilizar la aplicación.

El primer resultado npm obtenido en modo caché fue descartado. Los resultados de esta
tabla proceden de consultas con red habilitada al registro oficial y del contraste con
avisos de los mantenedores; un análisis sin avisos no garantiza ausencia de problemas.

## Qué se corrigió

- Se retiraron las contraseñas fijas de los seeds. El script se niega a ejecutarse
  en producción; localmente exige contraseñas privadas de al menos 16 caracteres
  mediante variables y ya no imprime credenciales. Esto no modifica cuentas existentes.
- Se retiró del índice de Git un PDF cargado por usuarios en uploads/cronogramas.
  El archivo local se conservó. Se excluyen uploads, uploads_private, claves, certificados,
  respaldos y archivos temporales tanto de Git como de los contextos Docker pertinentes.
- El backend copia a su imagen únicamente src y templates, además de los manifiestos
  de dependencias; no copia el directorio completo de trabajo. Sus tests se excluyen.
- Node 20 se reemplazó por Node 24 LTS; el backend fija Alpine 3.22 para conservar el
  cliente PostgreSQL 16 compatible con la instalación. El frontend usa Nginx 1.30.
- SheetJS se actualizó a 0.20.3 desde su CDN oficial en ambos proyectos, con integridad
  registrada en los lockfiles. Se actualizaron dependencias compatibles y Nodemailer
  a 10.5.0. uuid y qs se fijaron en versiones corregidas con overrides.
- Se corrigieron dependencias transitivas del frontend sin forzar una migración de
  react-scripts. El build real y todas las suites frontend pasaron después del cambio.
- Python usa FastAPI 0.162.4, Starlette 1.3.1, python-multipart 0.0.33 y dotenv 1.2.4.
  Calamine se fijó en 0.9.1. El árbol para Python 3.11 se resolvió y auditó sin instalarlo
  globalmente. Las pruebas funcionales se ejecutaron con Python 3.14 en entorno temporal.
- Se actualizaron los fixtures de las pruebas Python al esquema de columnas vigente y
  se aislaron de catálogos institucionales de la máquina. Los dos fallos se reprodujeron
  también con el entorno anterior antes de ajustar las pruebas; no se cambió el limpiador.
- Se bloquean peticiones a directorios del repositorio y archivos privados en Nginx.
  La política de cabeceras se comparte y también se aplica a index.html, donde las
  cabeceras de caché antes impedían heredar las del nivel server.
- Los registros de acceso HTTP de Express y Nginx evitan guardar URLs que puedan llevar
  tokens. Esto no garantiza que otros logs de controladores o errores nunca contengan
  datos personales; su revisión completa y la retención de logs siguen siendo necesarias.
- Se conservan los ajustes previos de filtrado de uploads, CORS, reintentos del respaldo,
  comprobación diaria del par de copias y reintentos de la tarea Windows.

## Qué se puede ver con Inspeccionar

El navegador necesita descargar HTML, CSS y JavaScript para ejecutar la interfaz.
Ese JavaScript seguirá siendo visible, incluso minificado y sin mapas. Deshabilitar
clic derecho o DevTools no lo protege. No se incorporó ese tipo de bloqueo.

La protección aplicada consiste en no publicar el backend, archivos .env, claves,
respaldos, fuentes originales ni mapas; y en limitar a una lista explícita las variables
REACT_APP_* que pueden incorporarse al bundle. El Client ID público de Google y la
site key pública de Turnstile son identificadores públicos; no son sus claves secretas.

El build se comparó además con valores secretos de los archivos locales de entorno.
Esa comparación no cubre secretos presentes solo en producción ni todas las posibles
codificaciones. `Audit-Repository.ps1` es un detector heurístico; admite valores de
ejemplo y omite la regla genérica de secreto literal en fixtures de tests, manteniendo
las reglas de tokens de proveedores y claves privadas. No sustituye revisión humana.

## Historial y credenciales anteriores

Retirar el PDF del índice y quitar las contraseñas fijas no elimina versiones pasadas
del historial. No se reescribió Git ni se hizo un push forzado. Los escaneos no encontraron
credenciales reales confirmadas en el historial analizado, pero las contraseñas antiguas
del seed deben tratarse como públicas si alguna cuenta llegó a utilizarlas. Si se
reutilizaron en otro lugar, deben rotarse allí también.

Antes de abrir el repositorio a terceros, revisar permisos del repositorio y decidir
la eliminación histórica del PDF si contiene información privada. Su presencia anterior
no se soluciona solo con .gitignore. Las credenciales reales viven en archivos privados
ignorados que se conservan; no se borraron para evitar pérdida de configuración.

## Comprobaciones locales repetibles

```powershell
powershell.exe -NoProfile -File scripts/security/Audit-Repository.ps1
cd frontend
npm ci
npm run build
npm test -- --watchAll=false --runInBand
cd ..
powershell.exe -NoProfile -File scripts/security/Test-BuildSecrets.ps1
cd backend
npm ci
node --test "src/**/*.test.js"
npm audit --omit=dev --offline=false --registry=https://registry.npmjs.org
```

La clasificación de devDependencies no evita instalar el compilador durante el build:
la etapa de construcción de Docker ejecuta npm ci completo. La etapa final copia solo
frontend/build. Los contextos excluyen archivos .env: los parámetros públicos se pasan
por los build args explícitos existentes.

## Validación manual del usuario antes de producción

Estos pasos corresponden exclusivamente al usuario o a un entorno de preproducción.
El asistente no los ejecutó en el servidor.

1. Conservar una copia recuperable y la clave externa del kit. Revisar que no existan
   cambios de producción sin commit que el script deploy.sh pueda sobrescribir.
2. Construir imágenes con descarga de bases actualizadas y validar la configuración
   con `docker compose config --quiet`. No imprimir `docker compose config` sin quiet,
   porque puede mostrar valores privados interpolados.
3. Validar `nginx -t` dentro de la imagen y realizar pruebas integradas en preproducción
   con Node 24, PostgreSQL y Python 3.11, incluyendo login Google, adjuntos, importación,
   envío de correo y restauración aislada de una copia. No se requiere nueva migración
   de esquema para los ajustes de esta entrega.
4. Confirmar respuestas 403/404 para /.env, /.git/config, /package.json,
   /backend/src/server.js, /src/archivo.jsx y cualquier *.map; comprobar /api/health,
   cabeceras CSP en /index.html y rechazo de temporales por ambas rutas uploads.
5. Instalar de nuevo la tarea local Windows con Install-LocalBackupTask.ps1 para
   aplicar los reintentos. El sincronizador necesita también los dos verificadores
   de copias que se entregan en scripts/backup.
6. Tras desplegar manualmente, comprobar una jornada completa de respaldos y descarga.

## Pendientes de seguridad de mayor alcance

Los adjuntos ordinarios todavía requieren clasificación y autorización por documento;
el filtro de temporales no convierte todas las URLs públicas en privadas. La copia
integral aún no tiene cifrado propio y falta una segunda copia independiente/inmutable
y el simulacro completo de restauración. Esos riesgos se detallan en SEGURIDAD_CIA_2026-11-11.md
y no se presentan como resueltos en esta entrega.

## Fuentes primarias consultadas

- Ciclo de soporte Node: https://nodejs.org/en/about/eol y https://github.com/nodejs/Release
- Nginx estable: https://nginx.org/en/download.html
- Instalación oficial SheetJS: https://docs.sheetjs.com/docs/getting-started/installation/nodejs/
- Avisos SheetJS: https://github.com/advisories/GHSA-4r6h-8v6p-xvw6 y https://github.com/advisories/GHSA-5pgg-2g8v-p4x9
- Avisos Multipart: https://github.com/Kludex/python-multipart/security/advisories
