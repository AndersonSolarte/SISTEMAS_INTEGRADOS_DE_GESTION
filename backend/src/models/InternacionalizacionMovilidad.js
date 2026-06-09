const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InternacionalizacionMovilidad = sequelize.define('internacionalizacion_movilidad', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  periodo: { type: DataTypes.STRING(40), allowNull: true },
  programa_dependencia: { type: DataTypes.STRING(300), allowNull: true },
  tipo_persona: { type: DataTypes.STRING(120), allowNull: true },
  alcance_movilidad: { type: DataTypes.STRING(80), allowNull: true },
  direccion_movilidad: { type: DataTypes.STRING(80), allowNull: true },
  actividad_movilidad: { type: DataTypes.STRING(300), allowNull: true },
  descripcion: { type: DataTypes.TEXT, allowNull: true },
  tipo_documento: { type: DataTypes.STRING(80), allowNull: true },
  numero_documento: { type: DataTypes.STRING(80), allowNull: true },
  primer_nombre: { type: DataTypes.STRING(160), allowNull: true },
  segundo_nombre: { type: DataTypes.STRING(160), allowNull: true },
  primer_apellido: { type: DataTypes.STRING(160), allowNull: true },
  segundo_apellido: { type: DataTypes.STRING(160), allowNull: true },
  pais_extranjero: { type: DataTypes.STRING(180), allowNull: true },
  estado_provincia_departamento: { type: DataTypes.STRING(180), allowNull: true },
  ciudad_municipio: { type: DataTypes.STRING(180), allowNull: true },
  institucion_extranjera: { type: DataTypes.STRING(300), allowNull: true },
  tipo_movilidad: { type: DataTypes.STRING(160), allowNull: true },
  num_dias_movilidad: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  movilidad_por_convenio: { type: DataTypes.STRING(80), allowNull: true },
  codigo_convenio: { type: DataTypes.STRING(120), allowNull: true },
  fuente_financiacion_nacional: { type: DataTypes.STRING(220), allowNull: true },
  valor_financiacion_nacional: { type: DataTypes.DECIMAL(18, 2), allowNull: true },
  fuente_financiacion_internacional: { type: DataTypes.STRING(220), allowNull: true },
  pais_financiador: { type: DataTypes.STRING(180), allowNull: true },
  valor_financiacion_internacional: { type: DataTypes.DECIMAL(18, 2), allowNull: true },
  financiacion_unicesmag: { type: DataTypes.STRING(80), allowNull: true },
  valor_financiacion_unicesmag: { type: DataTypes.DECIMAL(18, 2), allowNull: true },
  fecha_salida: { type: DataTypes.DATEONLY, allowNull: true },
  fecha_retorno: { type: DataTypes.DATEONLY, allowNull: true },
  modalidad: { type: DataTypes.STRING(120), allowNull: true },
  resultado_movilidad: { type: DataTypes.TEXT, allowNull: true },
  raw_data: { type: DataTypes.JSONB, allowNull: true },
  creado_por: { type: DataTypes.INTEGER, allowNull: true },
  actualizado_por: { type: DataTypes.INTEGER, allowNull: true }
});

module.exports = InternacionalizacionMovilidad;
