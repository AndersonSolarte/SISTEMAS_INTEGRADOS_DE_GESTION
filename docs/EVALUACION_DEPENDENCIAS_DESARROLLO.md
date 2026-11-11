# Evaluacion de dependencias de desarrollo

Revision: 2026-11-11. Consulta nueva al registro oficial con `npm audit --json`.
Resultado frontend: 19 paquetes senalados, 6 altos, 1 moderado y 12 bajos.
No se aplicaron cambios de dependencias en esta revision. Los avisos siguen abiertos;
esta evaluacion no constituye aceptacion del riesgo por el responsable del sistema.

El arbol de `react-scripts` usado para compilar y probar concentra estos avisos.
La imagen final prevista del frontend copia solo estaticos a nginx; no copia ese
arbol. Debe comprobarse tambien sobre la imagen Linux construida. Esto reduce la
exposicion del servidor final, pero no elimina riesgos durante compilacion o desarrollo.
Las auditorias previas con `--omit=dev` dieron cero en backend/frontend: deben repetirse
si cambian los lockfiles y antes de aprobar una nueva entrega.

| Grupo | Paquetes senalados | Exposicion y decision tecnica |
| --- | --- | --- |
| SVG/CSS | @svgr/plugin-svgo, css-select, css-what, svgo | Altos propagados y directos del optimizador. Compilar solo recursos del repositorio revisado. No procesar recursos SVG/CSS de terceros no revisados en el build. Evaluar actualizacion compatible del optimizador con pruebas visuales y de compilacion. |
| Servidor de desarrollo | webpack-dev-server, webpack-dev-middleware | Altos; incluyen exposicion de codigo y fallos por solicitudes maliciosas. No publicar `npm start`, HMR ni estos puertos en produccion. Loopback limita exposicion, pero no resuelve ataques desde paginas visitadas por el desarrollador. La correccion completa requiere sustituir/actualizar el arbol compatible del compilador. |
| Fusion de objetos | deepmerge | Bajo; contaminacion del prototipo del objeto devuelto. Tratar configuracion y plugins de build como codigo confiable revisado. Evaluar parche compatible cuando el mantenedor lo ofrezca. |
| Consumidores de deepmerge y herramientas | @jest/core, @rollup/plugin-node-resolve, @svgr/webpack, fork-ts-checker-webpack-plugin, jest, jest-cli, jest-config, jest-watch-typeahead, react-dev-utils, workbox-build, workbox-webpack-plugin | Bajos propagados por el arbol de desarrollo. No son once vulnerabilidades independientes del aplicativo en ejecucion. Mantenerlos en devDependencies y fuera de la imagen final. |
| Paquete principal | react-scripts | Moderado propagado. La sugerencia automatica de npm para varias cadenas es react-scripts 0.0.0; no es una actualizacion utilizable. No ejecutar `npm audit fix --force`. |

## Cierre necesario

1. Mantener compilacion en entorno aislado con codigo/dependencias revisados, sin
   credenciales privadas de produccion ni acceso al servidor de produccion.
2. Confirmar en la imagen final ausencia de node_modules y del servidor de desarrollo.
3. Preparar la sustitucion de Create React App por una herramienta mantenida en una
   tarea separada, conservando rutas, variables publicas, proxy, controles de build,
   plantillas, pruebas, CSP y funcionamiento de proveedores. No basta con forzar una
   version mayor de webpack-dev-server: react-scripts utiliza opciones de su API previa.
4. Repetir instalacion limpia, auditorias completas y de produccion, pruebas de interfaz,
   compilacion y pruebas Linux. Actualizar el manifiesto y paquete despues del cambio.
5. Si se pretende publicar antes de cerrar los avisos, el responsable debe documentar
   su evaluacion, controles y plazo de correccion. No presentar el resultado como cero
   vulnerabilidades ni marcar avisos como corregidos porque sean de desarrollo.

React anuncio la retirada de Create React App para nuevas aplicaciones y recomienda
migrar las existentes. El aviso oficial de webpack-dev-server confirma que hay ataques
disparados desde otra pagina que visita el desarrollador, incluso sin publicar el servidor.

## Fuentes

- https://react.dev/blog/2025/02/14/sunsetting-create-react-app
- https://github.com/webpack/webpack-dev-server/security/advisories/GHSA-f5vj-f2hx-8m93
- https://github.com/advisories/GHSA-q8pj-2vqx-8ggc
- https://github.com/advisories/GHSA-gcqx-w48m-w2h4

El JSON detallado de esta revision queda como evidencia local en
`tmp/release-validation/frontend-full-audit-current.json`; no contiene credenciales.
