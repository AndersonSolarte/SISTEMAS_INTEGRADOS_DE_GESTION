-- Migración: agrega columna observaciones a la tabla documentos
-- Fecha: 2026-04-16
-- Ejecutar una sola vez en el servidor de producción

ALTER TABLE documentos
  ADD COLUMN IF NOT EXISTS observaciones TEXT;
