require('dotenv').config();
if (process.env.NODE_ENV === 'production') {
  throw new Error('Los datos de ejemplo estan deshabilitados en produccion.');
}
const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD;
const seedViewerPassword = process.env.SEED_VIEWER_PASSWORD;
if (!seedAdminPassword || !seedViewerPassword || seedAdminPassword.length < 16 || seedViewerPassword.length < 16) {
  throw new Error('Configure SEED_ADMIN_PASSWORD y SEED_VIEWER_PASSWORD de al menos 16 caracteres para el entorno local.');
}
const { sequelize, testConnection } = require('../config/database');
const { User, MacroProceso, Proceso, SubProceso, TipoDocumentacion, Documento } = require('../models');

const runSeeds = async () => {
  try {
    console.log('🌱 Ejecutando seeds con datos completos...');
    await testConnection();
    
    // USUARIOS
    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@example.invalid';
    await User.findOrCreate({ where: { email: adminEmail }, defaults: { nombre: 'Administrador local', email: adminEmail, password: seedAdminPassword, role: 'administrador' } });
    const viewerEmail = process.env.SEED_VIEWER_EMAIL || 'viewer@example.invalid';
    await User.findOrCreate({ where: { email: viewerEmail }, defaults: { nombre: 'Consulta local', email: viewerEmail, password: seedViewerPassword, role: 'consulta' } });
    
    // MACRO PROCESOS
    const [mp1] = await MacroProceso.findOrCreate({ where: { nombre: 'Gestión Estratégica' } });
    const [mp2] = await MacroProceso.findOrCreate({ where: { nombre: 'Gestión Misional' } });
    const [mp3] = await MacroProceso.findOrCreate({ where: { nombre: 'Gestión de Apoyo' } });
    const [mp4] = await MacroProceso.findOrCreate({ where: { nombre: 'Gestión de Evaluación' } });
    
    // PROCESOS
    const [p1] = await Proceso.findOrCreate({ where: { nombre: 'Planeación Estratégica', macro_proceso_id: mp1.id } });
    const [p2] = await Proceso.findOrCreate({ where: { nombre: 'Direccionamiento Estratégico', macro_proceso_id: mp1.id } });
    const [p3] = await Proceso.findOrCreate({ where: { nombre: 'Prestación de Servicios', macro_proceso_id: mp2.id } });
    const [p4] = await Proceso.findOrCreate({ where: { nombre: 'Gestión de Proyectos', macro_proceso_id: mp2.id } });
    const [p5] = await Proceso.findOrCreate({ where: { nombre: 'Gestión del Talento Humano', macro_proceso_id: mp3.id } });
    const [p6] = await Proceso.findOrCreate({ where: { nombre: 'Gestión Financiera', macro_proceso_id: mp3.id } });
    const [p7] = await Proceso.findOrCreate({ where: { nombre: 'Auditoría Interna', macro_proceso_id: mp4.id } });
    const [p8] = await Proceso.findOrCreate({ where: { nombre: 'Mejora Continua', macro_proceso_id: mp4.id } });
    
    // SUBPROCESOS
    const [sp1] = await SubProceso.findOrCreate({ where: { nombre: 'Formulación de Objetivos', proceso_id: p1.id } });
    const [sp2] = await SubProceso.findOrCreate({ where: { nombre: 'Seguimiento Estratégico', proceso_id: p1.id } });
    const [sp3] = await SubProceso.findOrCreate({ where: { nombre: 'Políticas y Lineamientos', proceso_id: p2.id } });
    const [sp4] = await SubProceso.findOrCreate({ where: { nombre: 'Atención al Cliente', proceso_id: p3.id } });
    const [sp5] = await SubProceso.findOrCreate({ where: { nombre: 'Control de Calidad', proceso_id: p3.id } });
    const [sp6] = await SubProceso.findOrCreate({ where: { nombre: 'Planificación de Proyectos', proceso_id: p4.id } });
    const [sp7] = await SubProceso.findOrCreate({ where: { nombre: 'Reclutamiento y Selección', proceso_id: p5.id } });
    const [sp8] = await SubProceso.findOrCreate({ where: { nombre: 'Capacitación y Desarrollo', proceso_id: p5.id } });
    const [sp9] = await SubProceso.findOrCreate({ where: { nombre: 'Presupuesto y Contabilidad', proceso_id: p6.id } });
    const [sp10] = await SubProceso.findOrCreate({ where: { nombre: 'Tesorería', proceso_id: p6.id } });
    
    // TIPOS DE DOCUMENTACIÓN
    const [td1] = await TipoDocumentacion.findOrCreate({ where: { nombre: 'Manual' } });
    const [td2] = await TipoDocumentacion.findOrCreate({ where: { nombre: 'Procedimiento' } });
    const [td3] = await TipoDocumentacion.findOrCreate({ where: { nombre: 'Instructivo' } });
    const [td4] = await TipoDocumentacion.findOrCreate({ where: { nombre: 'Formato' } });
    const [td5] = await TipoDocumentacion.findOrCreate({ where: { nombre: 'Política' } });
    const [td6] = await TipoDocumentacion.findOrCreate({ where: { nombre: 'Caracterización' } });
    
    // DOCUMENTOS DE EJEMPLO (15 documentos)
    const documentos = [
      { codigo: 'MAN-GE-001', titulo: 'Manual de Planeación Estratégica', version: '2.0', subproceso_id: sp1.id, tipo_documentacion_id: td1.id, estado: 'vigente', autor: 'Dpto. Planeación', revisa: 'Juan Pérez', aprueba: 'María González' },
      { codigo: 'PROC-GE-001', titulo: 'Procedimiento de Formulación de Objetivos', version: '1.5', subproceso_id: sp1.id, tipo_documentacion_id: td2.id, estado: 'vigente', autor: 'Dpto. Planeación', revisa: 'Ana Torres', aprueba: 'Carlos Ramírez' },
      { codigo: 'MAN-GE-002', titulo: 'Manual de Seguimiento Estratégico', version: '3.0', subproceso_id: sp2.id, tipo_documentacion_id: td1.id, estado: 'vigente', autor: 'Dpto. Planeación', revisa: 'Laura Méndez', aprueba: 'Roberto Silva' },
      { codigo: 'POL-GE-001', titulo: 'Política de Calidad Institucional', version: '2.1', subproceso_id: sp3.id, tipo_documentacion_id: td5.id, estado: 'vigente', autor: 'Dirección General', revisa: 'Comité Directivo', aprueba: 'Director General' },
      { codigo: 'PROC-GM-001', titulo: 'Procedimiento de Atención al Cliente', version: '3.1', subproceso_id: sp4.id, tipo_documentacion_id: td2.id, estado: 'vigente', autor: 'Área de Servicio', revisa: 'Supervisor', aprueba: 'Gerente Operaciones' },
      { codigo: 'INST-GM-001', titulo: 'Instructivo de Manejo de Quejas y Reclamos', version: '1.0', subproceso_id: sp4.id, tipo_documentacion_id: td3.id, estado: 'vigente', autor: 'Área de Servicio', revisa: 'Jefe de Área', aprueba: 'Gerente' },
      { codigo: 'FOR-GM-001', titulo: 'Formato de Registro de No Conformidades', version: '2.0', subproceso_id: sp5.id, tipo_documentacion_id: td4.id, estado: 'vigente', autor: 'Control de Calidad', revisa: 'Auditor', aprueba: 'Director Calidad' },
      { codigo: 'MAN-GM-002', titulo: 'Manual de Control de Calidad', version: '4.0', subproceso_id: sp5.id, tipo_documentacion_id: td1.id, estado: 'vigente', autor: 'Control de Calidad', revisa: 'Equipo QA', aprueba: 'Director Calidad' },
      { codigo: 'PROC-GM-002', titulo: 'Procedimiento de Planificación de Proyectos', version: '2.5', subproceso_id: sp6.id, tipo_documentacion_id: td2.id, estado: 'vigente', autor: 'PMO', revisa: 'Gerente Proyectos', aprueba: 'Director Proyectos' },
      { codigo: 'POL-GA-001', titulo: 'Política de Reclutamiento y Selección', version: '1.0', subproceso_id: sp7.id, tipo_documentacion_id: td5.id, estado: 'vigente', autor: 'Gestión Humana', revisa: 'Jefe RRHH', aprueba: 'Director RRHH' },
      { codigo: 'PROC-GA-001', titulo: 'Procedimiento de Selección de Personal', version: '3.2', subproceso_id: sp7.id, tipo_documentacion_id: td2.id, estado: 'vigente', autor: 'Gestión Humana', revisa: 'Psicólogo', aprueba: 'Director RRHH' },
      { codigo: 'MAN-GA-001', titulo: 'Manual de Capacitación y Desarrollo', version: '2.0', subproceso_id: sp8.id, tipo_documentacion_id: td1.id, estado: 'vigente', autor: 'Desarrollo Organizacional', revisa: 'Jefe Desarrollo', aprueba: 'Director RRHH' },
      { codigo: 'PROC-GA-002', titulo: 'Procedimiento de Elaboración de Presupuesto', version: '1.8', subproceso_id: sp9.id, tipo_documentacion_id: td2.id, estado: 'vigente', autor: 'Dpto. Financiero', revisa: 'Contador', aprueba: 'Director Financiero' },
      { codigo: 'INST-GA-001', titulo: 'Instructivo de Manejo de Caja Menor', version: '1.2', subproceso_id: sp10.id, tipo_documentacion_id: td3.id, estado: 'vigente', autor: 'Tesorería', revisa: 'Tesorero', aprueba: 'Director Financiero' },
      { codigo: 'FOR-GA-001', titulo: 'Formato de Solicitud de Pago', version: '3.0', subproceso_id: sp10.id, tipo_documentacion_id: td4.id, estado: 'vigente', autor: 'Tesorería', revisa: 'Contador', aprueba: 'Director Financiero' }
    ];
    
    for (const doc of documentos) {
      await Documento.findOrCreate({ where: { codigo: doc.codigo }, defaults: doc });
    }
    
    console.log('');
    console.log('╔════════════════════════════════════════════════╗');
    console.log('║  ✅ Seeds completados exitosamente            ║');
    console.log('╠════════════════════════════════════════════════╣');
    console.log('║  👤 Usuarios: 2                                ║');
    console.log('║  📊 Macro Procesos: 4                          ║');
    console.log('║  📁 Procesos: 8                                ║');
    console.log('║  📂 Subprocesos: 10                            ║');
    console.log('║  📋 Tipos Documentación: 6                     ║');
    console.log('║  📄 Documentos: 15                             ║');
    console.log('╠════════════════════════════════════════════════╣');
    console.log('Usuarios locales preparados. Las credenciales no se imprimen.');
    console.log('╚════════════════════════════════════════════════╝');
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en seeds:', error);
    await sequelize.close();
    process.exit(1);
  }
};

runSeeds();
