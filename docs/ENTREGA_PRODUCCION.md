# Entrega preparada para produccion

Esta entrega es un candidato validado localmente. No se ha publicado ni desplegado.
El manifiesto del paquete identifica el commit base y las huellas del estado de trabajo,
incluidos los cambios aun no confirmados. No equivale a una aprobacion de produccion.

## Procedimiento preparado

`deploy.sh` sigue siendo de ejecucion exclusiva del usuario. Ahora:

1. Exige main y un repositorio sin cambios locales. Actualiza con fast-forward; no ejecuta
   reset --hard ni descarta trabajo.
2. Conserva el commit, compose e imagenes anteriores en .deployment-state, con permisos
   privados. No guarda las credenciales ni la configuracion interpolada.
3. Construye antes de cambiar contenedores, comprueba configuracion, acceso al almacenamiento,
   conexion PostgreSQL de solo lectura y nginx -t. Un fallo aqui mantiene los contenedores
   anteriores activos.
4. Espera las verificaciones de salud al iniciar las nuevas imagenes. Si falla ese arranque,
   intenta recuperar las imagenes anteriores usando el compose conservado.
5. Ejecuta las migraciones que ya formaban parte del procedimiento y comprueba salud final.
   Si una migracion falla, exige revision manual. Nunca restaura una base automaticamente
   ni descarta registros nuevos.

La sustitucion de contenedores puede causar una interrupcion breve. Este procedimiento
evita detenerlos durante la compilacion; no implementa un despliegue sin interrupciones.

## Comprobaciones antes de ejecutarlo

- Completar la construccion/arranque Linux y las pruebas Google/Turnstile y SMTP reales en
  preproduccion. Las pruebas de proveedores anteriores fueron simuladas o sin entrega.
- Confirmar respaldo integral, kit cifrado y clave externa recuperable. La configuracion
  privada .env, certificados y backend/keys existentes deben conservarse en el servidor:
  se excluyen del paquete de codigo.
- Revisar los 19 avisos pendientes de herramientas de desarrollo del frontend, seis altos.
  Los analisis de dependencias de produccion se incluyen por separado; no ocultar los
  avisos del compilador ni afirmar ausencia total de vulnerabilidades.
- Revisar y confirmar los cambios del candidato, y subir main solo cuando el usuario lo
  indique. El paquete no contiene .git y no se debe tratar como un checkout listo para
  ejecutar deploy.sh; la via habitual de actualizacion sigue siendo Git.

## Archivos y recuperacion

La entrega contiene codigo y plantillas, no datos ni secretos de produccion. Los archivos
del frontend se recompilan con los argumentos publicos del servidor; el build local se
usa como evidencia y no se distribuye para sustituir configuraciones de otro entorno.

El manifiesto contiene SHA-256 de cada archivo. La huella adjunta del tar.gz permite
comprobar su integridad de transporte; no es una firma digital de un tercero.

La recuperacion de imagenes usa .deployment-state/FECHA/rollback-images.yml junto al
docker-compose.previous.yml, manteniendo --project-directory apuntando al proyecto.
No usar down -v ni eliminar los volumenes. La vuelta de imagenes no revierte cambios
de esquema; revisar una migracion fallida antes de cualquier recuperacion manual.

Los archivos privados, cargas de usuarios, node_modules, mapas y herramientas del
simulacro se excluyen del paquete. Los informes funcionales completos permanecen en
docs/VALIDACION_LOCAL_2026-11-11.md y docs/PREPARACION_PRODUCCION_SEGURA_2026-11-11.md.

## Evidencia de este candidato

Validacion actual: 385 pruebas backend, 128 frontend, 4 Python y 4 escenarios de
despliegue simulado aprobados (521 en total). Compilacion frontend aprobada y auditorias
de dependencias de produccion backend/frontend con cero avisos conocidos. Se conserva
como referencia separada el ensayo integral anterior de respaldo y restauracion;
no sustituye las comprobaciones Linux y de proveedores reales indicadas arriba.


Jest aprobo las 34 suites y 128 pruebas, pero advirtio operaciones asincronas
abiertas al finalizar. Se cerro exclusivamente su proceso local despues del resultado;
queda pendiente depurar esos recursos del entorno de pruebas.

