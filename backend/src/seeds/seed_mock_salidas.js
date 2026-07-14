require('dotenv').config();
const { sequelize } = require('../config/database');
const ReporteSalidaSolicitud = require('../models/ReporteSalidaSolicitud');
const User = require('../models/User');
const Documento = require('../models/Documento');

async function main() {
  console.log('🌱 Starting 2-week mock departure report seed...');
  try {
    await sequelize.authenticate();
    console.log('Database connection authenticated.');

    // 1. Find users
    const users = await User.findAll({ limit: 5 });
    if (users.length === 0) {
      console.error('No users found in database! Run seeds first.');
      process.exit(1);
    }
    const adminUser = users.find(u => u.role === 'administrador') || users[0];
    const regularUser = users.find(u => u.email !== adminUser.email) || users[0];
    
    console.log(`Using Solicitante: ${regularUser.nombre} (ID: ${regularUser.id})`);
    console.log(`Using Jefe/Admin: ${adminUser.nombre} (ID: ${adminUser.id})`);

    // 2. Find a document to link
    const doc = await Documento.findOne();
    if (!doc) {
      console.error('No documents found in database! Run seeds first.');
      process.exit(1);
    }
    console.log(`Linking to document ID: ${doc.id}`);

    // Clean existing mock reports to keep database clean
    const deletedCount = await ReporteSalidaSolicitud.destroy({
      where: {
        consecutivo: {
          [sequelize.Sequelize.Op.like]: 'RS-MOCK-%'
        }
      }
    });
    console.log(`Cleaned up ${deletedCount} existing mock reports.`);

    const now = new Date();

    const mockReports = [
      // 1. Pendiente Jefe - EPS (1 day ago)
      {
        consecutivo: 'RS-MOCK-001',
        user_id: regularUser.id,
        documento_id: doc.id,
        jefe_inmediato_user_id: adminUser.id,
        estado: 'pendiente_aprobacion_jefe',
        solicitante_snapshot: { nombre: regularUser.nombre, email: regularUser.email, username: regularUser.email.split('@')[0] },
        jefe_snapshot: { nombre: adminUser.nombre, email: adminUser.email },
        datos_formulario: {
          salida: { tipo: 'cita_eps', categoria: 'salud', motivo: 'Cita con Odontología por EPS', fecha: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], hora_inicio: '08:00', hora_fin: '10:00' },
          personal: { documento: '1085223344' },
          laboral: { dependencia: 'Dirección de Planeación', cargo: 'Técnico de Planeación' }
        },
        tiempo_solicitado_minutos: 120,
        reposicion_aplica: false,
        reposicion_estado: 'no_aplica',
        trazabilidad: [
          { event: 'creada', timestamp: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(), actor: regularUser.nombre }
        ],
        created_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)
      },
      // 2. Pendiente GH - Diligencia Personal (2 days ago)
      {
        consecutivo: 'RS-MOCK-002',
        user_id: regularUser.id,
        documento_id: doc.id,
        jefe_inmediato_user_id: adminUser.id,
        estado: 'pendiente_aprobacion_gestion_humana',
        solicitante_snapshot: { nombre: regularUser.nombre, email: regularUser.email, username: regularUser.email.split('@')[0] },
        jefe_snapshot: { nombre: adminUser.nombre, email: adminUser.email },
        datos_formulario: {
          salida: { tipo: 'diligencia_personal', categoria: 'personales', motivo: 'Renovación de Licencia de Conducir', fecha: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], hora_inicio: '14:00', hora_fin: '17:00' },
          personal: { documento: '1085223344' },
          laboral: { dependencia: 'Dirección de Planeación', cargo: 'Técnico de Planeación' }
        },
        tiempo_solicitado_minutos: 180,
        reposicion_aplica: true,
        reposicion_minutos: 180,
        reposicion_estado: 'pendiente',
        jefe_aprobado_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000),
        trazabilidad: [
          { event: 'creada', timestamp: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(), actor: regularUser.nombre },
          { event: 'aprobada_jefe', timestamp: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000).toISOString(), actor: adminUser.nombre, detail: { observacion: 'Aprobado sin problemas.' } }
        ],
        created_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
      },
      // 3. Finalizada - Misional (3 days ago)
      {
        consecutivo: 'RS-MOCK-003',
        user_id: regularUser.id,
        documento_id: doc.id,
        jefe_inmediato_user_id: adminUser.id,
        estado: 'finalizada',
        solicitante_snapshot: { nombre: regularUser.nombre, email: regularUser.email, username: regularUser.email.split('@')[0] },
        jefe_snapshot: { nombre: adminUser.nombre, email: adminUser.email },
        datos_formulario: {
          salida: { tipo: 'reunion_institucional', categoria: 'propias_cargo', motivo: 'Reunión con delegados de Ministerio de Educación', fecha: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], hora_inicio: '10:00', hora_fin: '12:00' },
          personal: { documento: '1085223344' },
          laboral: { dependencia: 'Dirección de Planeación', cargo: 'Técnico de Planeación' }
        },
        tiempo_solicitado_minutos: 120,
        reposicion_aplica: false,
        reposicion_estado: 'no_aplica',
        jefe_aprobado_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000),
        gestion_humana_aprobado_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
        finalizado_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
        trazabilidad: [
          { event: 'creada', timestamp: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(), actor: regularUser.nombre },
          { event: 'aprobada_jefe', timestamp: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000).toISOString(), actor: adminUser.nombre },
          { event: 'aprobada_gestion_humana', timestamp: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(), actor: 'Gestión Humana' },
          { event: 'finalizada', timestamp: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(), actor: 'Sistema' }
        ],
        created_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
      },
      // 4. Finalizada - Reposición Cumplida con Abonos (4 days ago)
      {
        consecutivo: 'RS-MOCK-004',
        user_id: regularUser.id,
        documento_id: doc.id,
        jefe_inmediato_user_id: adminUser.id,
        estado: 'finalizada',
        solicitante_snapshot: { nombre: regularUser.nombre, email: regularUser.email, username: regularUser.email.split('@')[0] },
        jefe_snapshot: { nombre: adminUser.nombre, email: adminUser.email },
        datos_formulario: {
          salida: { tipo: 'diligencia_personal', categoria: 'personales', motivo: 'Firma de contrato de arrendamiento', fecha: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], hora_inicio: '09:00', hora_fin: '11:00' },
          personal: { documento: '1085223344' },
          laboral: { dependencia: 'Dirección de Planeación', cargo: 'Técnico de Planeación' }
        },
        tiempo_solicitado_minutos: 120,
        reposicion_aplica: true,
        reposicion_minutos: 120,
        reposicion_estado: 'cumplida',
        jefe_aprobado_at: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000),
        gestion_humana_aprobado_at: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
        finalizado_at: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
        observacion_gestion_humana: `[${new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toLocaleString('es-CO')}] Gestión Humana: Acreditó 2.0 horas - "El colaborador completó la reposición en la jornada contraria"`,
        trazabilidad: [
          { event: 'creada', timestamp: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(), actor: regularUser.nombre },
          { event: 'aprobada_jefe', timestamp: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000).toISOString(), actor: adminUser.nombre, detail: { observacion: 'Reposición acordada' } },
          { event: 'aprobada_gestion_humana', timestamp: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(), actor: 'Gestión Humana' },
          { event: 'finalizada', timestamp: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(), actor: 'Sistema' }
        ],
        created_at: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000)
      },
      // 5. Rechazada - Personal (5 days ago)
      {
        consecutivo: 'RS-MOCK-005',
        user_id: regularUser.id,
        documento_id: doc.id,
        jefe_inmediato_user_id: adminUser.id,
        estado: 'no_aprobada',
        solicitante_snapshot: { nombre: regularUser.nombre, email: regularUser.email, username: regularUser.email.split('@')[0] },
        jefe_snapshot: { nombre: adminUser.nombre, email: adminUser.email },
        datos_formulario: {
          salida: { tipo: 'diligencia_personal', categoria: 'personales', motivo: 'Compra de repuestos de computadora', fecha: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], hora_inicio: '15:00', hora_fin: '16:00' },
          personal: { documento: '1085223344' },
          laboral: { dependencia: 'Dirección de Planeación', cargo: 'Técnico de Planeación' }
        },
        tiempo_solicitado_minutos: 60,
        reposicion_aplica: false,
        reposicion_estado: 'no_aplica',
        trazabilidad: [
          { event: 'creada', timestamp: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(), actor: regularUser.nombre },
          { event: 'no_aprobada', timestamp: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000).toISOString(), actor: adminUser.nombre, detail: { observacion: 'Rechazado: Hay entrega de informes ese día.' } }
        ],
        created_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)
      },
      // 6. Finalizada - Salida Grupal (6 days ago)
      {
        consecutivo: 'RS-MOCK-006-G1',
        user_id: regularUser.id,
        documento_id: doc.id,
        jefe_inmediato_user_id: adminUser.id,
        estado: 'finalizada',
        solicitante_snapshot: { nombre: regularUser.nombre, email: regularUser.email, username: regularUser.email.split('@')[0] },
        jefe_snapshot: { nombre: adminUser.nombre, email: adminUser.email },
        datos_formulario: {
          grupo: {
            grupo_id: 'G-MOCK-2002',
            participantes: [
              { nombre: regularUser.nombre, documento: '1085223344' },
              { nombre: 'Camilo Castro', documento: '987654321' }
            ]
          },
          salida: { tipo: 'evento_institucional', categoria: 'propias_cargo', motivo: 'Participación en congreso de sistemas de gestión', fecha: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], hora_inicio: '08:00', hora_fin: '14:00' },
          personal: { documento: '1085223344' },
          laboral: { dependencia: 'Dirección de Planeación', cargo: 'Técnico de Planeación' }
        },
        tiempo_solicitado_minutos: 360,
        reposicion_aplica: false,
        reposicion_estado: 'no_aplica',
        jefe_aprobado_at: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000),
        gestion_humana_aprobado_at: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
        finalizado_at: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
        trazabilidad: [
          { event: 'creada', timestamp: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(), actor: regularUser.nombre },
          { event: 'aprobada_jefe', timestamp: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000).toISOString(), actor: adminUser.nombre },
          { event: 'aprobada_gestion_humana', timestamp: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(), actor: 'Gestión Humana' },
          { event: 'finalizada', timestamp: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(), actor: 'Sistema' }
        ],
        created_at: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)
      },
      // 7. Pendiente SST - Salud (7 days ago)
      {
        consecutivo: 'RS-MOCK-007',
        user_id: regularUser.id,
        documento_id: doc.id,
        jefe_inmediato_user_id: adminUser.id,
        estado: 'pendiente_aprobacion_sst',
        solicitante_snapshot: { nombre: regularUser.nombre, email: regularUser.email, username: regularUser.email.split('@')[0] },
        jefe_snapshot: { nombre: adminUser.nombre, email: adminUser.email },
        datos_formulario: {
          salida: { tipo: 'cita_eps', categoria: 'salud', motivo: 'Cita con especialista de cardiología', fecha: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], hora_inicio: '14:00', hora_fin: '16:00' },
          personal: { documento: '1085223344' },
          laboral: { dependencia: 'Dirección de Planeación', cargo: 'Técnico de Planeación' }
        },
        tiempo_solicitado_minutos: 120,
        reposicion_aplica: false,
        reposicion_estado: 'no_aplica',
        jefe_aprobado_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000),
        gestion_humana_aprobado_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
        trazabilidad: [
          { event: 'creada', timestamp: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), actor: regularUser.nombre },
          { event: 'aprobada_jefe', timestamp: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000).toISOString(), actor: adminUser.nombre },
          { event: 'aprobada_gestion_humana', timestamp: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(), actor: 'Gestión Humana' }
        ],
        created_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      },
      // 8. Finalizada - Terapias de Salud (8 days ago)
      {
        consecutivo: 'RS-MOCK-008',
        user_id: regularUser.id,
        documento_id: doc.id,
        jefe_inmediato_user_id: adminUser.id,
        estado: 'finalizada',
        solicitante_snapshot: { nombre: regularUser.nombre, email: regularUser.email, username: regularUser.email.split('@')[0] },
        jefe_snapshot: { nombre: adminUser.nombre, email: adminUser.email },
        datos_formulario: {
          salida: { tipo: 'terapias', categoria: 'salud', motivo: 'Sesión de terapia física de rodilla', fecha: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], hora_inicio: '16:00', hora_fin: '18:00' },
          personal: { documento: '1085223344' },
          laboral: { dependencia: 'Dirección de Planeación', cargo: 'Técnico de Planeación' }
        },
        tiempo_solicitado_minutos: 120,
        reposicion_aplica: false,
        reposicion_estado: 'no_aplica',
        jefe_aprobado_at: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000),
        gestion_humana_aprobado_at: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
        finalizado_at: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
        trazabilidad: [
          { event: 'creada', timestamp: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(), actor: regularUser.nombre },
          { event: 'aprobada_jefe', timestamp: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000).toISOString(), actor: adminUser.nombre },
          { event: 'aprobada_gestion_humana', timestamp: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(), actor: 'Gestión Humana' },
          { event: 'finalizada', timestamp: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(), actor: 'Sistema' }
        ],
        created_at: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000)
      },
      // 9. Finalizada - Misional / Ponencia (9 days ago)
      {
        consecutivo: 'RS-MOCK-009',
        user_id: regularUser.id,
        documento_id: doc.id,
        jefe_inmediato_user_id: adminUser.id,
        estado: 'finalizada',
        solicitante_snapshot: { nombre: regularUser.nombre, email: regularUser.email, username: regularUser.email.split('@')[0] },
        jefe_snapshot: { nombre: adminUser.nombre, email: adminUser.email },
        datos_formulario: {
          salida: { tipo: 'ponencia', categoria: 'propias_cargo', motivo: 'Ponente en encuentro regional de acreditación', fecha: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], hora_inicio: '08:00', hora_fin: '12:00' },
          personal: { documento: '1085223344' },
          laboral: { dependencia: 'Dirección de Planeación', cargo: 'Técnico de Planeación' }
        },
        tiempo_solicitado_minutos: 240,
        reposicion_aplica: false,
        reposicion_estado: 'no_aplica',
        jefe_aprobado_at: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000),
        gestion_humana_aprobado_at: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
        finalizado_at: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
        trazabilidad: [
          { event: 'creada', timestamp: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000).toISOString(), actor: regularUser.nombre },
          { event: 'aprobada_jefe', timestamp: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000).toISOString(), actor: adminUser.nombre },
          { event: 'aprobada_gestion_humana', timestamp: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(), actor: 'Gestión Humana' },
          { event: 'finalizada', timestamp: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(), actor: 'Sistema' }
        ],
        created_at: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000)
      },
      // 10. Finalizada - Calamidad Doméstica (10 days ago)
      {
        consecutivo: 'RS-MOCK-010',
        user_id: regularUser.id,
        documento_id: doc.id,
        jefe_inmediato_user_id: adminUser.id,
        estado: 'finalizada',
        solicitante_snapshot: { nombre: regularUser.nombre, email: regularUser.email, username: regularUser.email.split('@')[0] },
        jefe_snapshot: { nombre: adminUser.nombre, email: adminUser.email },
        datos_formulario: {
          salida: { tipo: 'calamidad', categoria: 'personales', motivo: 'Inundación en domicilio por tubería rota', fecha: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], hora_inicio: '08:00', hora_fin: '12:00' },
          personal: { documento: '1085223344' },
          laboral: { dependencia: 'Dirección de Planeación', cargo: 'Técnico de Planeación' }
        },
        tiempo_solicitado_minutos: 240,
        reposicion_aplica: true,
        reposicion_minutos: 240,
        reposicion_estado: 'cumplida',
        jefe_aprobado_at: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000),
        gestion_humana_aprobado_at: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
        finalizado_at: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
        observacion_gestion_humana: `[${new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toLocaleString('es-CO')}] Gestión Humana: Acreditó 4.0 horas - "Se compensó con horas autorizadas previas de trabajo adicional"`,
        trazabilidad: [
          { event: 'creada', timestamp: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(), actor: regularUser.nombre },
          { event: 'aprobada_jefe', timestamp: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000).toISOString(), actor: adminUser.nombre },
          { event: 'aprobada_gestion_humana', timestamp: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(), actor: 'Gestión Humana' },
          { event: 'finalizada', timestamp: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(), actor: 'Sistema' }
        ],
        created_at: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000)
      },
      // 11. Finalizada - Misional / Salida entre campus (11 days ago)
      {
        consecutivo: 'RS-MOCK-011',
        user_id: regularUser.id,
        documento_id: doc.id,
        jefe_inmediato_user_id: adminUser.id,
        estado: 'finalizada',
        solicitante_snapshot: { nombre: regularUser.nombre, email: regularUser.email, username: regularUser.email.split('@')[0] },
        jefe_snapshot: { nombre: adminUser.nombre, email: adminUser.email },
        datos_formulario: {
          salida: { tipo: 'salida_campus', categoria: 'propias_cargo', motivo: 'Traslado a sede Alvernia para revisión física de archivos', fecha: new Date(now.getTime() - 11 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], hora_inicio: '14:00', hora_fin: '16:00' },
          personal: { documento: '1085223344' },
          laboral: { dependencia: 'Dirección de Planeación', cargo: 'Técnico de Planeación' }
        },
        tiempo_solicitado_minutos: 120,
        reposicion_aplica: false,
        reposicion_estado: 'no_aplica',
        jefe_aprobado_at: new Date(now.getTime() - 11 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000),
        gestion_humana_aprobado_at: new Date(now.getTime() - 11 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
        finalizado_at: new Date(now.getTime() - 11 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
        trazabilidad: [
          { event: 'creada', timestamp: new Date(now.getTime() - 11 * 24 * 60 * 60 * 1000).toISOString(), actor: regularUser.nombre },
          { event: 'aprobada_jefe', timestamp: new Date(now.getTime() - 11 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000).toISOString(), actor: adminUser.nombre },
          { event: 'aprobada_gestion_humana', timestamp: new Date(now.getTime() - 11 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(), actor: 'Gestión Humana' },
          { event: 'finalizada', timestamp: new Date(now.getTime() - 11 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(), actor: 'Sistema' }
        ],
        created_at: new Date(now.getTime() - 11 * 24 * 60 * 60 * 1000)
      },
      // 12. Finalizada - Cita médica (12 days ago)
      {
        consecutivo: 'RS-MOCK-012',
        user_id: regularUser.id,
        documento_id: doc.id,
        jefe_inmediato_user_id: adminUser.id,
        estado: 'finalizada',
        solicitante_snapshot: { nombre: regularUser.nombre, email: regularUser.email, username: regularUser.email.split('@')[0] },
        jefe_snapshot: { nombre: adminUser.nombre, email: adminUser.email },
        datos_formulario: {
          salida: { tipo: 'cita_eps', categoria: 'salud', motivo: 'Cita con Optómetra examen visual anual', fecha: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], hora_inicio: '10:00', hora_fin: '12:00' },
          personal: { documento: '1085223344' },
          laboral: { dependencia: 'Dirección de Planeación', cargo: 'Técnico de Planeación' }
        },
        tiempo_solicitado_minutos: 120,
        reposicion_aplica: false,
        reposicion_estado: 'no_aplica',
        jefe_aprobado_at: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000),
        gestion_humana_aprobado_at: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
        finalizado_at: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
        trazabilidad: [
          { event: 'creada', timestamp: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000).toISOString(), actor: regularUser.nombre },
          { event: 'aprobada_jefe', timestamp: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000).toISOString(), actor: adminUser.nombre },
          { event: 'aprobada_gestion_humana', timestamp: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(), actor: 'Gestión Humana' },
          { event: 'finalizada', timestamp: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(), actor: 'Sistema' }
        ],
        created_at: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000)
      },
      // 13. Finalizada - Calamidad (13 days ago)
      {
        consecutivo: 'RS-MOCK-013',
        user_id: regularUser.id,
        documento_id: doc.id,
        jefe_inmediato_user_id: adminUser.id,
        estado: 'finalizada',
        solicitante_snapshot: { nombre: regularUser.nombre, email: regularUser.email, username: regularUser.email.split('@')[0] },
        jefe_snapshot: { nombre: adminUser.nombre, email: adminUser.email },
        datos_formulario: {
          salida: { tipo: 'calamidad', categoria: 'personales', motivo: 'Cita médica de urgencia de hijo menor', fecha: new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], hora_inicio: '11:00', hora_fin: '15:00' },
          personal: { documento: '1085223344' },
          laboral: { dependencia: 'Dirección de Planeación', cargo: 'Técnico de Planeación' }
        },
        tiempo_solicitado_minutos: 240,
        reposicion_aplica: true,
        reposicion_minutos: 240,
        reposicion_estado: 'cumplida',
        jefe_aprobado_at: new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000),
        gestion_humana_aprobado_at: new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
        finalizado_at: new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
        observacion_gestion_humana: `[${new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toLocaleString('es-CO')}] Gestión Humana: Acreditó 4.0 horas - "El colaborador cumplió la reposición de tiempo en dos bloques de 2 horas en la semana"`,
        trazabilidad: [
          { event: 'creada', timestamp: new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000).toISOString(), actor: regularUser.nombre },
          { event: 'aprobada_jefe', timestamp: new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000).toISOString(), actor: adminUser.nombre },
          { event: 'aprobada_gestion_humana', timestamp: new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(), actor: 'Gestión Humana' },
          { event: 'finalizada', timestamp: new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(), actor: 'Sistema' }
        ],
        created_at: new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000)
      },
      // 14. Finalizada - Misional / Visita IES (14 days ago)
      {
        consecutivo: 'RS-MOCK-014',
        user_id: regularUser.id,
        documento_id: doc.id,
        jefe_inmediato_user_id: adminUser.id,
        estado: 'finalizada',
        solicitante_snapshot: { nombre: regularUser.nombre, email: regularUser.email, username: regularUser.email.split('@')[0] },
        jefe_snapshot: { nombre: adminUser.nombre, email: adminUser.email },
        datos_formulario: {
          salida: { tipo: 'visita_ies', categoria: 'propias_cargo', motivo: 'Visita técnica de pares a institución de educación superior aliada', fecha: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], hora_inicio: '08:00', hora_fin: '16:00' },
          personal: { documento: '1085223344' },
          laboral: { dependencia: 'Dirección de Planeación', cargo: 'Técnico de Planeación' }
        },
        tiempo_solicitado_minutos: 480,
        reposicion_aplica: false,
        reposicion_estado: 'no_aplica',
        jefe_aprobado_at: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000),
        gestion_humana_aprobado_at: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
        finalizado_at: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
        trazabilidad: [
          { event: 'creada', timestamp: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(), actor: regularUser.nombre },
          { event: 'aprobada_jefe', timestamp: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000).toISOString(), actor: adminUser.nombre },
          { event: 'aprobada_gestion_humana', timestamp: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(), actor: 'Gestión Humana' },
          { event: 'finalizada', timestamp: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(), actor: 'Sistema' }
        ],
        created_at: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
      }
    ];

    // Bulk create
    for (const report of mockReports) {
      await ReporteSalidaSolicitud.create(report);
      console.log(`Created report: ${report.consecutivo}`);
    }

    console.log('✅ Successfully seeded mock reports!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding mock reports:', error);
    process.exit(1);
  }
}

main();
