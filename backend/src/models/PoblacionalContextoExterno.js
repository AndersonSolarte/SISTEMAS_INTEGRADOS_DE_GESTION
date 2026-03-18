const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PoblacionalContextoExterno = sequelize.define('poblacional_contexto_externo', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  anio: { type: DataTypes.INTEGER, allowNull: true },
  periodo_referencia: { type: DataTypes.STRING(40), allowNull: true },
  tipo_registro: { type: DataTypes.STRING(40), allowNull: false }, // oferta | serie
  base_indicador: { type: DataTypes.STRING(80), allowNull: false }, // Oferta, Inscritos, etc
  alcance: { type: DataTypes.STRING(30), allowNull: true }, // Nacional | Regional
  hoja_fuente: { type: DataTypes.STRING(120), allowNull: true },
  sector: { type: DataTypes.STRING(80), allowNull: true },
  ies: { type: DataTypes.STRING(260), allowNull: true },
  programa_comparado: { type: DataTypes.STRING(320), allowNull: true },
  programa_objetivo: { type: DataTypes.STRING(320), allowNull: true },
  departamento: { type: DataTypes.STRING(120), allowNull: true },
  municipio: { type: DataTypes.STRING(120), allowNull: true },
  modalidad: { type: DataTypes.STRING(80), allowNull: true },
  periodicidad: { type: DataTypes.STRING(80), allowNull: true },
  creditos: { type: DataTypes.INTEGER, allowNull: true },
  semestres: { type: DataTypes.INTEGER, allowNull: true },
  costo_matricula: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
  fecha_registro_snies: { type: DataTypes.STRING(40), allowNull: true },
  oferta_tag: { type: DataTypes.STRING(40), allowNull: true }, // NACIONAL | REGIONAL (segun fila)
  valor: { type: DataTypes.DECIMAL(14, 2), allowNull: true }, // conteo/métrica
  raw_data: { type: DataTypes.TEXT, allowNull: true },
  creado_por: { type: DataTypes.INTEGER, allowNull: true },
  actualizado_por: { type: DataTypes.INTEGER, allowNull: true }
});

module.exports = PoblacionalContextoExterno;
