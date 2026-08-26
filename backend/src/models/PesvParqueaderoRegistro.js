const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PesvParqueaderoRegistro = sequelize.define('pesv_parqueadero_registros', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  identificacion: { type: DataTypes.STRING(40), allowNull: true },
  nombres_apellidos: { type: DataTypes.STRING(220), allowNull: false },
  correo: { type: DataTypes.STRING(220), allowNull: true },
  vinculacion: { type: DataTypes.STRING(140), allowNull: true },
  dependencia_programa: { type: DataTypes.STRING(220), allowNull: true },
  campus: { type: DataTypes.STRING(120), allowNull: true },
  parqueadero_ingreso: { type: DataTypes.STRING(140), allowNull: true },
  categoria_ingreso: { type: DataTypes.STRING(120), allowNull: true },
  tipo_vehiculo: { type: DataTypes.STRING(120), allowNull: true },
  placa: { type: DataTypes.STRING(30), allowNull: true },
  curso_pas: { type: DataTypes.STRING(120), allowNull: true },
  pago_validacion: { type: DataTypes.STRING(120), allowNull: true },
  soat_vigencia: { type: DataTypes.DATEONLY, allowNull: true },
  soat_vigencia_texto: { type: DataTypes.STRING(140), allowNull: true },
  soat_estado: { type: DataTypes.STRING(60), allowNull: true },
  soat_fecha_expedicion: { type: DataTypes.DATEONLY, allowNull: true },
  soat_fecha_inicio: { type: DataTypes.DATEONLY, allowNull: true },
  soat_numero_poliza: { type: DataTypes.STRING(120), allowNull: true },
  soat_entidad: { type: DataTypes.STRING(220), allowNull: true },
  tecnomecanica_vigencia: { type: DataTypes.DATEONLY, allowNull: true },
  tecnomecanica_vigencia_texto: { type: DataTypes.STRING(180), allowNull: true },
  rtm_estado: { type: DataTypes.STRING(60), allowNull: true },
  rtm_fecha_expedicion: { type: DataTypes.DATEONLY, allowNull: true },
  rtm_numero_certificado: { type: DataTypes.STRING(140), allowNull: true },
  rtm_cda: { type: DataTypes.STRING(220), allowNull: true },
  vehiculo_fecha_matricula: { type: DataTypes.DATEONLY, allowNull: true },
  vehiculo_clase: { type: DataTypes.STRING(120), allowNull: true },
  vehiculo_servicio: { type: DataTypes.STRING(120), allowNull: true },
  vehiculo_modelo: { type: DataTypes.STRING(20), allowNull: true },
  rtm_fecha_exigibilidad: { type: DataTypes.DATEONLY, allowNull: true },
  ultima_consulta_runt: { type: DataTypes.DATE, allowNull: true },
  estado_validacion_runt: { type: DataTypes.STRING(60), allowNull: false, defaultValue: 'PENDIENTE' },
  horario: { type: DataTypes.STRING(180), allowNull: true },
  observaciones: { type: DataTypes.TEXT, allowNull: true },
  ultima_notificacion_soat: { type: DataTypes.DATE, allowNull: true },
  ultima_notificacion_tecnomecanica: { type: DataTypes.DATE, allowNull: true },
  creado_por: { type: DataTypes.INTEGER, allowNull: true },
  actualizado_por: { type: DataTypes.INTEGER, allowNull: true }
}, {
  indexes: [
    { fields: ['identificacion'] },
    { fields: ['placa'] },
    { fields: ['soat_vigencia'] },
    { fields: ['tecnomecanica_vigencia'] },
    { fields: ['rtm_estado', 'rtm_fecha_exigibilidad'] },
    { fields: ['campus', 'parqueadero_ingreso'] }
  ]
});

module.exports = PesvParqueaderoRegistro;
