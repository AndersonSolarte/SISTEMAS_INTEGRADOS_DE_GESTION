-- Migración: agregar edad y facultad a poblacional_matriculados
-- Ejecutar UNA SOLA VEZ en el servidor PostgreSQL

ALTER TABLE poblacional_matriculados
  ADD COLUMN IF NOT EXISTS edad INTEGER,
  ADD COLUMN IF NOT EXISTS facultad VARCHAR(220);
