CREATE TABLE IF NOT EXISTS public.cantidad_total_egresados (
  id SERIAL PRIMARY KEY,
  anio INTEGER NOT NULL,
  programa VARCHAR(220),
  cantidad INTEGER,
  detalle VARCHAR(220),
  creado_por INTEGER,
  actualizado_por INTEGER
);

CREATE INDEX IF NOT EXISTS idx_cantidad_total_egresados_anio
  ON public.cantidad_total_egresados (anio);

CREATE INDEX IF NOT EXISTS idx_cantidad_total_egresados_programa
  ON public.cantidad_total_egresados (programa);
