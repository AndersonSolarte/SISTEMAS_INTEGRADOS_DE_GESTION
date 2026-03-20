const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Almacena la configuración de equivalencias Saber 11 → Saber Pro / TyT.
 * Cada "tipo" define qué columnas de resultados_saber11 se promedian
 * para calcular el equivalente de cada módulo genérico de Saber Pro.
 *
 * Estructura de `reglas` (JSONB):
 * {
 *   "lectura_critica":           ["col_s11_a", "col_s11_b"],
 *   "razonamiento_cuantitativo": ["col_s11_c"],
 *   "competencias_ciudadanas":   ["col_s11_d", "col_s11_e"],
 *   "comunicacion_escrita":      ["col_s11_f"],
 *   "ingles":                    ["col_s11_g"]
 * }
 *
 * Detección del tipo: se elige el primer tipo cuya columna detectora
 * (campo `detector_col`) sea NOT NULL en el registro del estudiante.
 */
const VaEquivalenciaConfig = sequelize.define('va_equivalencias_config', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  tipo_numero: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  nombre: { type: DataTypes.STRING(60), allowNull: false },
  descripcion: { type: DataTypes.TEXT, allowNull: true },
  detector_col: {
    type: DataTypes.STRING(80),
    allowNull: true,
    comment: 'Columna de resultados_saber11 que identifica este tipo (NOT NULL = activo)'
  },
  detector_extra: {
    type: DataTypes.STRING(80),
    allowNull: true,
    comment: 'Segunda columna requerida para confirmar el tipo (AND NOT NULL)'
  },
  reglas: { type: DataTypes.JSONB, allowNull: false },
  activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  orden_deteccion: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 99,
    comment: 'Menor número = mayor prioridad en detección automática'
  }
});

module.exports = VaEquivalenciaConfig;
