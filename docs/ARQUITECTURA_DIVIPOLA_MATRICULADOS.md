# Arquitectura Profesional DIVIPOLA + Matriculados

## Objetivo
Usar DIVIPOLA como catalogo maestro para enriquecer Matriculados con codigos DANE auditables y trazables.

## Componentes implementados
- `ref_departamentos`: catalogo maestro de departamentos.
- `ref_municipios`: catalogo maestro de municipios.
- `ref_divipola_cargas`: versionamiento y trazabilidad de cargas DIVIPOLA.
- `matriculados_ubicacion_incidencias`: cola de calidad para casos sin match o match parcial.
- Campos nuevos en `poblacional_matriculados`:
  - `codigo_departamento_nacimiento`
  - `codigo_municipio_nacimiento`
  - `match_confianza_ubicacion`
  - `match_metodo_ubicacion`
  - `match_score_ubicacion`
  - `match_actualizado_en`

## Flujo operativo recomendado
1. Ejecutar migraciones:
   - `npm --prefix backend run migrate`
2. Cargar catalogo DIVIPOLA (versionado):
   - `npm --prefix backend run divipola:load -- "C:\ruta\DIVIPOLA_Municipios.xlsx"`
3. Enriquecer Matriculados con codigos DANE:
   - `npm --prefix backend run divipola:enrich-matriculados`
4. Consumir dashboard georreferenciado:
   - `GET /planeacion/gestion-informacion?categoria=Poblacional&aggregate=matriculados_geo_dashboard`
5. Gestionar incidencias de cruce:
   - `GET /planeacion/gestion-informacion/divipola/incidencias?page=1&limit=10&estado=pendiente&search=...`
   - `PUT /planeacion/gestion-informacion/divipola/incidencias/:id`
     - `{"action":"apply_suggested"}`
     - `{"action":"mark_ignored"}`
     - `{"action":"manual_assign","codigo_departamento_nacimiento":"52","codigo_municipio_nacimiento":"52001"}`

## Criterios de calidad del cruce
- `exacto_departamento_municipio`: match alto por nombre normalizado.
- `fuzzy_departamento` / `fuzzy_municipio`: match aproximado con score.
- `solo_departamento`: municipio sin match.
- `sin_match`: no se encontro match; pasa a incidencia.

## Buenas practicas aplicadas
- Catalogo maestro separado de datos transaccionales.
- ETL idempotente con version de carga.
- Trazabilidad de incidencias para revision manual.
- Indices para consultas y agregaciones de mapa.
- API orientada a datos enriquecidos y metricas de cobertura.
