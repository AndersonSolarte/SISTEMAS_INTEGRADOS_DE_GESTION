const User = require('./User');
const UserModulePermission = require('./UserModulePermission');
const DiccionarioCorreccionTexto = require('./DiccionarioCorreccionTexto');
const MacroProceso = require('./MacroProceso');
const Proceso = require('./Proceso');
const SubProceso = require('./SubProceso');
const TipoDocumentacion = require('./TipoDocumentacion');
const Documento = require('./Documento');
const DocumentoFavorito = require('./DocumentoFavorito');
const Estadistica = require('./Estadistica');
const PoblacionalInscrito = require('./PoblacionalInscrito');
const PoblacionalAdmitido = require('./PoblacionalAdmitido');
const PoblacionalPrimerCurso = require('./PoblacionalPrimerCurso');
const PoblacionalMatriculado = require('./PoblacionalMatriculado');
const PoblacionalGraduado = require('./PoblacionalGraduado');
const PoblacionalCaracterizacion = require('./PoblacionalCaracterizacion');
const PoblacionalCantidadTotalEgresado = require('./PoblacionalCantidadTotalEgresado');
const PoblacionalDesercionPeriodo = require('./PoblacionalDesercionPeriodo');
const PoblacionalDesercionCohorte = require('./PoblacionalDesercionCohorte');
const PoblacionalDesercionAnual = require('./PoblacionalDesercionAnual');
const PoblacionalContextoExterno = require('./PoblacionalContextoExterno');
const PoblacionalEmpleabilidad = require('./PoblacionalEmpleabilidad');
const Saber11Resultado = require('./Saber11Resultado');
const SaberProResultadoIndividual = require('./SaberProResultadoIndividual');
const SaberProResultadoAgregado = require('./SaberProResultadoAgregado');
const GestionInformacionCarga = require('./GestionInformacionCarga');
const GeorreferenciaDepartamento = require('./GeorreferenciaDepartamento');
const GeorreferenciaMunicipio = require('./GeorreferenciaMunicipio');
const RecursoHumanoDocente = require('./RecursoHumanoDocente');
const RecursoHumanoAdministrativo = require('./RecursoHumanoAdministrativo');
const RecursoHumanoOutsourcing = require('./RecursoHumanoOutsourcing');
const RecursoHumanoOnda = require('./RecursoHumanoOnda');
const RefDepartamento = require('./RefDepartamento');
const RefMunicipio = require('./RefMunicipio');
const RefDivipolaCarga = require('./RefDivipolaCarga');
const MatriculadosUbicacionIncidencia = require('./MatriculadosUbicacionIncidencia');
const UserActivityLog = require('./UserActivityLog');
const VaEquivalenciaConfig = require('./VaEquivalenciaConfig');
const PlanAccion = require('./PlanAccion');

// Relaciones existentes
MacroProceso.hasMany(Proceso, { foreignKey: 'macro_proceso_id', as: 'procesos' });
Proceso.belongsTo(MacroProceso, { foreignKey: 'macro_proceso_id', as: 'macroProceso' });
Proceso.hasMany(SubProceso, { foreignKey: 'proceso_id', as: 'subprocesos' });
SubProceso.belongsTo(Proceso, { foreignKey: 'proceso_id', as: 'proceso' });
SubProceso.hasMany(Documento, { foreignKey: 'subproceso_id', as: 'documentos' });
Documento.belongsTo(SubProceso, { foreignKey: 'subproceso_id', as: 'subproceso' });
TipoDocumentacion.hasMany(Documento, { foreignKey: 'tipo_documentacion_id', as: 'documentos' });
Documento.belongsTo(TipoDocumentacion, { foreignKey: 'tipo_documentacion_id', as: 'tipoDocumentacion' });

// Favoritos de documentos
User.hasMany(DocumentoFavorito, { foreignKey: 'user_id', as: 'favoritos' });
DocumentoFavorito.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Documento.hasMany(DocumentoFavorito, { foreignKey: 'documento_id', as: 'favoritos' });
DocumentoFavorito.belongsTo(Documento, { foreignKey: 'documento_id', as: 'documento' });


// NUEVAS RELACIONES - Auditoría de documentos
User.hasMany(Documento, { foreignKey: 'creado_por', as: 'documentosCreados' });
Documento.belongsTo(User, { foreignKey: 'creado_por', as: 'creador' });

User.hasMany(Documento, { foreignKey: 'actualizado_por', as: 'documentosActualizados' });
Documento.belongsTo(User, { foreignKey: 'actualizado_por', as: 'actualizador' });

User.hasMany(Estadistica, { foreignKey: 'creado_por', as: 'estadisticasCreadas' });
Estadistica.belongsTo(User, { foreignKey: 'creado_por', as: 'creador' });

User.hasMany(Estadistica, { foreignKey: 'actualizado_por', as: 'estadisticasActualizadas' });
Estadistica.belongsTo(User, { foreignKey: 'actualizado_por', as: 'actualizador' });

User.hasMany(PoblacionalInscrito, { foreignKey: 'creado_por', as: 'inscritosCreados' });
PoblacionalInscrito.belongsTo(User, { foreignKey: 'creado_por', as: 'creador' });
User.hasMany(PoblacionalInscrito, { foreignKey: 'actualizado_por', as: 'inscritosActualizados' });
PoblacionalInscrito.belongsTo(User, { foreignKey: 'actualizado_por', as: 'actualizador' });

User.hasMany(PoblacionalAdmitido, { foreignKey: 'creado_por', as: 'admitidosCreados' });
PoblacionalAdmitido.belongsTo(User, { foreignKey: 'creado_por', as: 'creador' });
User.hasMany(PoblacionalAdmitido, { foreignKey: 'actualizado_por', as: 'admitidosActualizados' });
PoblacionalAdmitido.belongsTo(User, { foreignKey: 'actualizado_por', as: 'actualizador' });

User.hasMany(PoblacionalPrimerCurso, { foreignKey: 'creado_por', as: 'primerCursoCreados' });
PoblacionalPrimerCurso.belongsTo(User, { foreignKey: 'creado_por', as: 'creador' });
User.hasMany(PoblacionalPrimerCurso, { foreignKey: 'actualizado_por', as: 'primerCursoActualizados' });
PoblacionalPrimerCurso.belongsTo(User, { foreignKey: 'actualizado_por', as: 'actualizador' });

User.hasMany(PoblacionalMatriculado, { foreignKey: 'creado_por', as: 'matriculadosCreados' });
PoblacionalMatriculado.belongsTo(User, { foreignKey: 'creado_por', as: 'creador' });
User.hasMany(PoblacionalMatriculado, { foreignKey: 'actualizado_por', as: 'matriculadosActualizados' });
PoblacionalMatriculado.belongsTo(User, { foreignKey: 'actualizado_por', as: 'actualizador' });

User.hasMany(PoblacionalGraduado, { foreignKey: 'creado_por', as: 'graduadosCreados' });
PoblacionalGraduado.belongsTo(User, { foreignKey: 'creado_por', as: 'creador' });
User.hasMany(PoblacionalGraduado, { foreignKey: 'actualizado_por', as: 'graduadosActualizados' });
PoblacionalGraduado.belongsTo(User, { foreignKey: 'actualizado_por', as: 'actualizador' });

User.hasMany(PoblacionalCaracterizacion, { foreignKey: 'creado_por', as: 'caracterizacionCreados' });
PoblacionalCaracterizacion.belongsTo(User, { foreignKey: 'creado_por', as: 'creador' });
User.hasMany(PoblacionalCaracterizacion, { foreignKey: 'actualizado_por', as: 'caracterizacionActualizados' });
PoblacionalCaracterizacion.belongsTo(User, { foreignKey: 'actualizado_por', as: 'actualizador' });

User.hasMany(PoblacionalCantidadTotalEgresado, { foreignKey: 'creado_por', as: 'cantidadTotalEgresadosCreados' });
PoblacionalCantidadTotalEgresado.belongsTo(User, { foreignKey: 'creado_por', as: 'creador' });
User.hasMany(PoblacionalCantidadTotalEgresado, { foreignKey: 'actualizado_por', as: 'cantidadTotalEgresadosActualizados' });
PoblacionalCantidadTotalEgresado.belongsTo(User, { foreignKey: 'actualizado_por', as: 'actualizador' });

User.hasMany(PoblacionalDesercionPeriodo, { foreignKey: 'creado_por', as: 'desercionPeriodoCreados' });
PoblacionalDesercionPeriodo.belongsTo(User, { foreignKey: 'creado_por', as: 'creador' });
User.hasMany(PoblacionalDesercionPeriodo, { foreignKey: 'actualizado_por', as: 'desercionPeriodoActualizados' });
PoblacionalDesercionPeriodo.belongsTo(User, { foreignKey: 'actualizado_por', as: 'actualizador' });

User.hasMany(PoblacionalDesercionCohorte, { foreignKey: 'creado_por', as: 'desercionCohorteCreados' });
PoblacionalDesercionCohorte.belongsTo(User, { foreignKey: 'creado_por', as: 'creador' });
User.hasMany(PoblacionalDesercionCohorte, { foreignKey: 'actualizado_por', as: 'desercionCohorteActualizados' });
PoblacionalDesercionCohorte.belongsTo(User, { foreignKey: 'actualizado_por', as: 'actualizador' });

User.hasMany(PoblacionalDesercionAnual, { foreignKey: 'creado_por', as: 'desercionAnualCreados' });
PoblacionalDesercionAnual.belongsTo(User, { foreignKey: 'creado_por', as: 'creador' });
User.hasMany(PoblacionalDesercionAnual, { foreignKey: 'actualizado_por', as: 'desercionAnualActualizados' });
PoblacionalDesercionAnual.belongsTo(User, { foreignKey: 'actualizado_por', as: 'actualizador' });

User.hasMany(PoblacionalContextoExterno, { foreignKey: 'creado_por', as: 'contextoExternoCreados' });
PoblacionalContextoExterno.belongsTo(User, { foreignKey: 'creado_por', as: 'creador' });
User.hasMany(PoblacionalContextoExterno, { foreignKey: 'actualizado_por', as: 'contextoExternoActualizados' });
PoblacionalContextoExterno.belongsTo(User, { foreignKey: 'actualizado_por', as: 'actualizador' });

User.hasMany(PoblacionalEmpleabilidad, { foreignKey: 'creado_por', as: 'empleabilidadCreados' });
PoblacionalEmpleabilidad.belongsTo(User, { foreignKey: 'creado_por', as: 'creador' });
User.hasMany(PoblacionalEmpleabilidad, { foreignKey: 'actualizado_por', as: 'empleabilidadActualizados' });
PoblacionalEmpleabilidad.belongsTo(User, { foreignKey: 'actualizado_por', as: 'actualizador' });

User.hasMany(Saber11Resultado, { foreignKey: 'creado_por', as: 'saber11ResultadosCreados' });
Saber11Resultado.belongsTo(User, { foreignKey: 'creado_por', as: 'creador' });
User.hasMany(Saber11Resultado, { foreignKey: 'actualizado_por', as: 'saber11ResultadosActualizados' });
Saber11Resultado.belongsTo(User, { foreignKey: 'actualizado_por', as: 'actualizador' });

User.hasMany(SaberProResultadoIndividual, { foreignKey: 'creado_por', as: 'saberProResultadosIndividualesCreados' });
SaberProResultadoIndividual.belongsTo(User, { foreignKey: 'creado_por', as: 'creador' });
User.hasMany(SaberProResultadoIndividual, { foreignKey: 'actualizado_por', as: 'saberProResultadosIndividualesActualizados' });
SaberProResultadoIndividual.belongsTo(User, { foreignKey: 'actualizado_por', as: 'actualizador' });

User.hasMany(SaberProResultadoAgregado, { foreignKey: 'creado_por', as: 'saberProResultadosAgregadosCreados' });
SaberProResultadoAgregado.belongsTo(User, { foreignKey: 'creado_por', as: 'creador' });
User.hasMany(SaberProResultadoAgregado, { foreignKey: 'actualizado_por', as: 'saberProResultadosAgregadosActualizados' });
SaberProResultadoAgregado.belongsTo(User, { foreignKey: 'actualizado_por', as: 'actualizador' });

User.hasMany(GestionInformacionCarga, { foreignKey: 'creado_por', as: 'cargasGestionInformacion' });
GestionInformacionCarga.belongsTo(User, { foreignKey: 'creado_por', as: 'creador' });
User.hasMany(RefDivipolaCarga, { foreignKey: 'creado_por', as: 'cargasDivipola' });
RefDivipolaCarga.belongsTo(User, { foreignKey: 'creado_por', as: 'creador' });
User.hasMany(MatriculadosUbicacionIncidencia, { foreignKey: 'resuelto_por', as: 'incidenciasUbicacionResueltas' });
MatriculadosUbicacionIncidencia.belongsTo(User, { foreignKey: 'resuelto_por', as: 'resolutor' });

User.hasMany(GeorreferenciaDepartamento, { foreignKey: 'creado_por', as: 'georreferenciaDepartamentosCreados' });
GeorreferenciaDepartamento.belongsTo(User, { foreignKey: 'creado_por', as: 'creador' });
User.hasMany(GeorreferenciaDepartamento, { foreignKey: 'actualizado_por', as: 'georreferenciaDepartamentosActualizados' });
GeorreferenciaDepartamento.belongsTo(User, { foreignKey: 'actualizado_por', as: 'actualizador' });

User.hasMany(GeorreferenciaMunicipio, { foreignKey: 'creado_por', as: 'georreferenciaMunicipiosCreados' });
GeorreferenciaMunicipio.belongsTo(User, { foreignKey: 'creado_por', as: 'creador' });
User.hasMany(GeorreferenciaMunicipio, { foreignKey: 'actualizado_por', as: 'georreferenciaMunicipiosActualizados' });
GeorreferenciaMunicipio.belongsTo(User, { foreignKey: 'actualizado_por', as: 'actualizador' });

User.hasMany(UserModulePermission, { foreignKey: 'user_id', as: 'modulePermissions' });
UserModulePermission.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(DiccionarioCorreccionTexto, { foreignKey: 'creado_por', as: 'diccionarioCorreccionesCreadas' });
DiccionarioCorreccionTexto.belongsTo(User, { foreignKey: 'creado_por', as: 'creador' });
User.hasMany(DiccionarioCorreccionTexto, { foreignKey: 'actualizado_por', as: 'diccionarioCorreccionesActualizadas' });
DiccionarioCorreccionTexto.belongsTo(User, { foreignKey: 'actualizado_por', as: 'actualizador' });

User.hasMany(PlanAccion, { foreignKey: 'creado_por', as: 'planAccionCreados' });
PlanAccion.belongsTo(User, { foreignKey: 'creado_por', as: 'creador' });
User.hasMany(PlanAccion, { foreignKey: 'actualizado_por', as: 'planAccionActualizados' });
PlanAccion.belongsTo(User, { foreignKey: 'actualizado_por', as: 'actualizador' });

module.exports = {
  User,
  UserModulePermission,
  DiccionarioCorreccionTexto,
  MacroProceso,
  Proceso,
  SubProceso,
  TipoDocumentacion,
  Documento,
  DocumentoFavorito,
  Estadistica,
  PoblacionalInscrito,
  PoblacionalAdmitido,
  PoblacionalPrimerCurso,
  PoblacionalMatriculado,
  PoblacionalGraduado,
  PoblacionalCaracterizacion,
  PoblacionalCantidadTotalEgresado,
  PoblacionalDesercionPeriodo,
  PoblacionalDesercionCohorte,
  PoblacionalDesercionAnual,
  PoblacionalContextoExterno,
  PoblacionalEmpleabilidad,
  Saber11Resultado,
  SaberProResultadoIndividual,
  SaberProResultadoAgregado,
  GestionInformacionCarga,
  GeorreferenciaDepartamento,
  GeorreferenciaMunicipio,
  RecursoHumanoDocente,
  RecursoHumanoAdministrativo,
  RecursoHumanoOutsourcing,
  RecursoHumanoOnda,
  RefDepartamento,
  RefMunicipio,
  RefDivipolaCarga,
  MatriculadosUbicacionIncidencia,
  UserActivityLog,
  VaEquivalenciaConfig,
  PlanAccion
};
