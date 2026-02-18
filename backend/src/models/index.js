const User = require('./User');
const MacroProceso = require('./MacroProceso');
const Proceso = require('./Proceso');
const SubProceso = require('./SubProceso');
const TipoDocumentacion = require('./TipoDocumentacion');
const Documento = require('./Documento');

MacroProceso.hasMany(Proceso, { foreignKey: 'macro_proceso_id', as: 'procesos' });
Proceso.belongsTo(MacroProceso, { foreignKey: 'macro_proceso_id', as: 'macroProceso' });
Proceso.hasMany(SubProceso, { foreignKey: 'proceso_id', as: 'subprocesos' });
SubProceso.belongsTo(Proceso, { foreignKey: 'proceso_id', as: 'proceso' });
SubProceso.hasMany(Documento, { foreignKey: 'subproceso_id', as: 'documentos' });
Documento.belongsTo(SubProceso, { foreignKey: 'subproceso_id', as: 'subproceso' });
TipoDocumentacion.hasMany(Documento, { foreignKey: 'tipo_documentacion_id', as: 'documentos' });
Documento.belongsTo(TipoDocumentacion, { foreignKey: 'tipo_documentacion_id', as: 'tipoDocumentacion' });

module.exports = { User, MacroProceso, Proceso, SubProceso, TipoDocumentacion, Documento };