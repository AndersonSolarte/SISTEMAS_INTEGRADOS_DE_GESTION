# Changelog

Todas las modificaciones relevantes del proyecto se documentan en este archivo.

El formato sigue una estructura inspirada en `Keep a Changelog`.

## [Unreleased]

### Changed
- Se unifico la ejecucion local para usar `frontend`, `backend` y `python-service` en Docker, conectando contra PostgreSQL 18 local por `host.docker.internal:5432`.
- El servicio `db` de Docker quedo como opcional mediante el perfil `docker-db`, para evitar duplicidad de datos y conflictos de puertos con la base local.
- Se actualizaron los puertos operativos locales a `8081` para frontend y `5001` para backend.

## [2026-02-23] - Gestion de la Informacion y dashboards poblacionales

### Added
- Modulo `Gestion de la Informacion` con flujo de gestion de bases, control de cargues y visualizacion estadistica.
- Subbases poblacionales para importacion y analisis: `Inscritos`, `Admitidos`, `Primer Curso`, `Matriculados`, `Graduados` y `Caracterizacion`.
- Estructura inicial de `Saber Pro` con soporte para `Resultados individuales` (modelo, rutas, controlador e interfaz base).
- Nuevos modelos backend para estadistica y cargues (`Estadistica`, `GestionInformacionCarga`) y modelos poblacionales.
- Nuevas rutas y servicios frontend/backend para el modulo de gestion de informacion.
- Dashboard de `Caracterizacion` por secciones tematicas:
  - Victimas del conflicto armado
  - Afrodescendientes
  - Estratos socioeconomicos
  - Grupos etnicos
- Analisis automatico dinamico bajo graficas (segun filtros y datos activos).

### Changed
- Rediseño de la vista estadistica poblacional con layout responsive y componentes visuales mas profesionales.
- Mejora de filtros con seleccion automatica de ultimos 7 anos, seleccion manual ampliable y sincronizacion entre `Años` y `Periodos`.
- Mejoras visuales en graficas:
  - etiquetas dentro de barras
  - etiquetas inteligentes fuera de barras pequenas
  - mejor contraste y legibilidad
  - centrado y distribucion de paneles
- Pestañas de secciones (`Inscritos...`, `Matriculados`, `Graduados`, `Caracterizacion`) rediseñadas con estilo uniforme y responsive.
- Cambio de refresco de datos de auto-refresh periodico a actualizacion manual/controlada desde la interfaz.
- Optimizacion de carga estadistica usando agregados backend (`poblacional_series`, `caracterizacion_dashboard`).

### Fixed
- Correcciones en importacion de `Matriculados` y `Graduados` por longitudes de campos (fechas en texto).
- Mejor manejo de errores de importacion para mostrar mensajes mas claros.
- Correcciones en seleccion/deseleccion de `Seleccionar todos` en filtros multiples.
- Correcciones en visualizacion de anos/periodos y sincronizacion de filtros para que las graficas reflejen la seleccion real.
- Ajustes de color/contraste en etiquetas y barras para mejorar visibilidad.

