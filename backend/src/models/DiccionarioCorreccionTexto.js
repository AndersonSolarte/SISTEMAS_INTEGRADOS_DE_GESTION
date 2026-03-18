const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DiccionarioCorreccionTexto = sequelize.define('diccionario_correccion_texto', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  ambito: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'GENERAL' }, // GENERAL | CONTEXTO_EXTERNO | ...
  columna: { type: DataTypes.STRING(120), allowNull: false, defaultValue: '*' }, // PROGRAMA | IES | ...
  valor_detectado: { type: DataTypes.STRING(500), allowNull: false },
  valor_estandar: { type: DataTypes.STRING(500), allowNull: false },
  activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  prioridad: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100 },
  observacion: { type: DataTypes.STRING(500), allowNull: true },
  creado_por: { type: DataTypes.INTEGER, allowNull: true },
  actualizado_por: { type: DataTypes.INTEGER, allowNull: true }
});

module.exports = DiccionarioCorreccionTexto;
