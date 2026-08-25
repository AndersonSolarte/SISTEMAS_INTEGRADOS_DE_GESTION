const { Op, QueryTypes, Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');
const { CronogramaMovilidad, CronogramaMovilidadActividad, User, PoblacionalMatriculado, sequelize } = require('../models');
const { generateCronogramaPdfBuffer } = require('../services/cronogramaMovilidadPdfService');
const emailService = require('../services/emailService');

const UPLOADS_CRONOGRAMAS_DIR = path.join(__dirname, '../../uploads/cronogramas');
if (!fs.existsSync(UPLOADS_CRONOGRAMAS_DIR)) {
  fs.mkdirSync(UPLOADS_CRONOGRAMAS_DIR, { recursive: true });
}

// 1. Crear o Guardar Borrador
const crearOBorrador = async (req, res) => {
  try {
    const user = req.user;
    const {
      programa_academico,
      facultad,
      codigo_oficio,
      asunto_oficio,
      cuerpo_oficio,
      coordinador_practica,
      email_coordinador,
      telefono_coordinador,
      actividades
    } = req.body;

    if (!actividades || !Array.isArray(actividades) || actividades.length === 0) {
      return res.status(400).json({ error: 'Debe incluir al menos una actividad en el cronograma' });
    }

    const cronograma = await CronogramaMovilidad.create({
      id_director: user.id,
      nombre_director: user.nombre,
      email_director: user.email,
      programa_academico: programa_academico || user.dependencia || 'Programa Académico',
      facultad: facultad || 'FACULTAD DE EDUCACIÓN',
      codigo_oficio,
      asunto_oficio,
      cuerpo_oficio,
      coordinador_practica,
      email_coordinador,
      telefono_coordinador,
      estado: 'borrador',
      trazabilidad: [{
        event: 'creado_borrador',
        actor: { id: user.id, nombre: user.nombre, email: user.email },
        at: new Date()
      }]
    });

    const actividadesRows = actividades.map((act) => ({
      id_cronograma: cronograma.id,
      fecha_salida: act.fecha_salida,
      fecha_regreso: act.fecha_regreso,
      hora_salida: act.hora_salida || '07:00 AM',
      hora_regreso: act.hora_regreso || '04:00 PM',
      requiere_viaticos: act.requiere_viaticos !== false,
      alojamiento: act.alojamiento || 'No requiere alojamiento',
      transporte: act.transporte || 'Terrestre Intermunicipal',
      entidad_destino: act.entidad_destino || '',
      funciones: act.funciones,
      alcance: act.alcance || 'Regional',
      pais: act.pais || 'COLOMBIA',
      departamento: act.departamento || 'NARIÑO',
      municipio: act.municipio || '',
      localidad_texto: act.localidad_texto || `${act.municipio || ''} - ${act.departamento || ''}`,
      contexto_practica: act.contexto_practica,
      responsables: act.responsables || [],
      estudiantes: act.estudiantes || [],
      estado_actividad: 'programada'
    }));

    const creadas = await CronogramaMovilidadActividad.bulkCreate(actividadesRows);

    return res.status(201).json({
      message: 'Cronograma creado exitosamente en borrador',
      cronograma: { ...cronograma.toJSON(), actividades: creadas }
    });
  } catch (error) {
    console.error('Error al crear cronograma:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
};

// 2. Obtener Lista de Cronogramas
const obtenerCronogramas = async (req, res) => {
  try {
    const user = req.user;
    const { programa } = req.query;
    let whereClause = {};

    const isAuthority = ['administrador', 'gestion_por_procesos', 'planeacion_estrategica'].includes(user.role)
      || (user.cargo && /vicerrec/i.test(user.cargo))
      || (user.dependencia && /vicerrec/i.test(user.dependencia));

    if (!isAuthority) {
      if (user.cargo && /director/i.test(user.cargo)) {
        whereClause.programa_academico = user.dependencia || user.programa_academico;
      } else {
        whereClause.id_director = user.id;
      }
    }

    if (programa) {
      whereClause.programa_academico = programa;
    }

    const cronogramas = await CronogramaMovilidad.findAll({
      where: whereClause,
      include: [{ model: CronogramaMovilidadActividad, as: 'actividades' }],
      order: [['created_at', 'DESC']]
    });

    return res.json({ cronogramas });
  } catch (error) {
    console.error('Error al consultar cronogramas:', error);
    return res.status(500).json({ error: error.message || 'Error al obtener cronogramas' });
  }
};

// 3. Obtener Cronograma por ID
const obtenerPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const cronograma = await CronogramaMovilidad.findByPk(id, {
      include: [{ model: CronogramaMovilidadActividad, as: 'actividades' }]
    });

    if (!cronograma) {
      return res.status(404).json({ error: 'Cronograma no encontrado' });
    }

    return res.json({ cronograma });
  } catch (error) {
    console.error('Error al obtener cronograma:', error);
    return res.status(500).json({ error: 'Error al obtener detalle de cronograma' });
  }
};

// 4. Actualizar Cronograma / Editar Actividades
const actualizarCronograma = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const {
      programa_academico,
      facultad,
      codigo_oficio,
      asunto_oficio,
      cuerpo_oficio,
      coordinador_practica,
      email_coordinador,
      telefono_coordinador,
      actividades
    } = req.body;

    const cronograma = await CronogramaMovilidad.findByPk(id);
    if (!cronograma) {
      return res.status(404).json({ error: 'Cronograma no encontrado' });
    }

    await cronograma.update({
      programa_academico: programa_academico || cronograma.programa_academico,
      facultad: facultad || cronograma.facultad,
      codigo_oficio: codigo_oficio !== undefined ? codigo_oficio : cronograma.codigo_oficio,
      asunto_oficio: asunto_oficio !== undefined ? asunto_oficio : cronograma.asunto_oficio,
      cuerpo_oficio: cuerpo_oficio !== undefined ? cuerpo_oficio : cronograma.cuerpo_oficio,
      coordinador_practica: coordinador_practica !== undefined ? coordinador_practica : cronograma.coordinador_practica,
      email_coordinador: email_coordinador !== undefined ? email_coordinador : cronograma.email_coordinador,
      telefono_coordinador: telefono_coordinador !== undefined ? telefono_coordinador : cronograma.telefono_coordinador
    });

    if (actividades && Array.isArray(actividades)) {
      await CronogramaMovilidadActividad.destroy({ where: { id_cronograma: cronograma.id } });
      const actividadesRows = actividades.map((act) => ({
        id_cronograma: cronograma.id,
        fecha_salida: act.fecha_salida,
        fecha_regreso: act.fecha_regreso,
        hora_salida: act.hora_salida || '06:00 AM',
        hora_regreso: act.hora_regreso || '06:00 PM',
        requiere_viaticos: act.requiere_viaticos !== false,
        alojamiento: act.alojamiento || 'Hotel / Hospedaje en destino',
        transporte: act.transporte || 'Terrestre Intermunicipal',
        entidad_destino: act.entidad_destino || '',
        funciones: act.funciones,
        alcance: act.alcance || 'Regional',
        pais: act.pais || 'COLOMBIA',
        departamento: act.departamento || 'NARIÑO',
        municipio: act.municipio || '',
        localidad_texto: act.localidad_texto || `${act.municipio || ''} - ${act.departamento || ''}`,
        contexto_practica: act.contexto_practica,
        responsables: act.responsables || [],
        estudiantes: act.estudiantes || [],
        estado_actividad: 'programada'
      }));
      await CronogramaMovilidadActividad.bulkCreate(actividadesRows);
    }

    const updated = await CronogramaMovilidad.findByPk(id, {
      include: [{ model: CronogramaMovilidadActividad, as: 'actividades' }]
    });

    return res.json({ message: 'Cronograma actualizado correctamente', cronograma: updated });
  } catch (error) {
    console.error('Error al actualizar cronograma:', error);
    return res.status(500).json({ error: error.message || 'Error al actualizar cronograma' });
  }
};

// 5. Radicar Cronograma (Director)
const radicarCronograma = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const cronograma = await CronogramaMovilidad.findByPk(id, {
      include: [{ model: CronogramaMovilidadActividad, as: 'actividades' }]
    });

    if (!cronograma) {
      return res.status(404).json({ error: 'Cronograma no encontrado' });
    }

    // Generar PDF del oficio
    const pdfBuffer = await generateCronogramaPdfBuffer(cronograma, cronograma.actividades);
    const pdfFilename = `oficio_cronograma_${cronograma.id}_${Date.now()}.pdf`;
    const pdfFilePath = path.join(UPLOADS_CRONOGRAMAS_DIR, pdfFilename);
    fs.writeFileSync(pdfFilePath, pdfBuffer);

    const trazabilidad = Array.isArray(cronograma.trazabilidad) ? [...cronograma.trazabilidad] : [];
    trazabilidad.push({
      event: 'radicado',
      actor: { id: user.id, nombre: user.nombre, email: user.email },
      at: new Date()
    });

    await cronograma.update({
      estado: 'en_revision_academica',
      radicado_at: new Date(),
      pdf_oficio_path: `/uploads/cronogramas/${pdfFilename}`,
      trazabilidad
    });

    // Enviar notificación por correo a Vicerrectoría Académica
    const academicaEmail = process.env.VICERRECTORIA_ACADEMICA_EMAIL || 'vicerrectoria.academica@unicesmag.edu.co';
    const linkRevision = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/practica-integral-movilidad?cronogramaId=${cronograma.id}&action=review`;

    await emailService.sendMailDirect({
      to: academicaEmail,
      subject: `[SIAC] Solicitud de Visto Bueno Cronograma de Movilidad - ${cronograma.programa_academico}`,
      html: emailService.renderInstitutionalTemplate({
        title: 'Revisión y Visto Bueno de Cronograma de Práctica Integral de Movilidad',
        introHtml: `<p>Cordial Saludo de Paz y Bien,</p><p>Estimada <strong>Vicerrectoría Académica</strong>,</p><p>Se ha radicado una nueva solicitud de aprobación de <strong>Cronograma de Práctica Integral de Movilidad</strong> en el sistema SIAC UNICESMAG para su revisión y Visto Bueno institucional.</p>`,
        bodyHtml: `
          <div style="margin: 18px 0; border: 1px solid #d6e4f5; border-radius: 12px; overflow: hidden; background: #ffffff; box-shadow: 0 4px 14px rgba(11, 58, 111, 0.06);">
            <div style="background: linear-gradient(135deg, #eff6ff 0%, #f8fbff 100%); border-bottom: 1px solid #d6e4f5; padding: 12px 18px;">
              <p style="margin: 0; font-weight: 800; color: #0b3a6f; letter-spacing: 0.02em;">Resumen del Cronograma Radicado</p>
            </div>
            <div style="padding: 16px 18px; color: #334155;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; font-weight: 700; color: #334155; width: 180px;">Código Cronograma:</td>
                  <td style="padding: 6px 0; color: #0b3a6f; font-weight: 800;">CRON-${cronograma.id}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: 700; color: #334155;">Programa Académico:</td>
                  <td style="padding: 6px 0; color: #0f172a;">${cronograma.programa_academico}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: 700; color: #334155;">Director Responsable:</td>
                  <td style="padding: 6px 0; color: #0f172a;">${cronograma.nombre_director} (${cronograma.email_director})</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: 700; color: #334155;">Total Actividades:</td>
                  <td style="padding: 6px 0; color: #0f172a;">${(cronograma.actividades || []).length} Actividad(es) Programadas</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: 700; color: #334155;">Estado Actual:</td>
                  <td style="padding: 6px 0; color: #2563eb; font-weight: 700;">En Revisión Académica</td>
                </tr>
              </table>
            </div>
          </div>
          <div style="text-align: center; margin-top: 24px;">
            <a href="${linkRevision}" target="_blank" rel="noopener noreferrer" style="display: inline-block; min-width: 250px; background: #0b3a6f; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 800; text-align: center; box-shadow: 0 4px 12px rgba(11, 58, 111, 0.2);">
              Revisar y Conceder Visto Bueno
            </a>
          </div>
        `
      })
    }).catch(err => console.error('Error enviando correo a Vicerrectoría Académica:', err));

    return res.json({ message: 'Cronograma radicado exitosamente', cronograma });
  } catch (error) {
    console.error('Error al radicar cronograma:', error);
    return res.status(500).json({ error: error.message || 'Error al radicar cronograma' });
  }
};

// 6. Visto Bueno por Vicerrectoría Académica
const vistoBuenoAcademica = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const cronograma = await CronogramaMovilidad.findByPk(id, {
      include: [{ model: CronogramaMovilidadActividad, as: 'actividades' }]
    });

    if (!cronograma) {
      return res.status(404).json({ error: 'Cronograma no encontrado' });
    }

    const trazabilidad = Array.isArray(cronograma.trazabilidad) ? [...cronograma.trazabilidad] : [];
    trazabilidad.push({
      event: 'visto_bueno_academica',
      actor: { id: user.id, nombre: user.nombre, email: user.email },
      at: new Date()
    });

    await cronograma.update({
      estado: 'en_revision_financiera',
      visto_bueno_academica_at: new Date(),
      visto_bueno_academica_by: user.nombre,
      trazabilidad
    });

    // Re-generar PDF con sello de Visto Bueno
    const pdfBuffer = await generateCronogramaPdfBuffer(cronograma, cronograma.actividades);
    const pdfFilename = `oficio_cronograma_${cronograma.id}_vb_${Date.now()}.pdf`;
    const pdfFilePath = path.join(UPLOADS_CRONOGRAMAS_DIR, pdfFilename);
    fs.writeFileSync(pdfFilePath, pdfBuffer);
    await cronograma.update({ pdf_oficio_path: `/uploads/cronogramas/${pdfFilename}` });

    // Notificar a Vicerrectoría Financiera y Copia al Director
    const financieraEmail = process.env.VICERRECTORIA_FINANCIERA_EMAIL || 'jcnandar@unicesmag.edu.co';
    const linkRevision = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/practica-integral-movilidad?cronogramaId=${cronograma.id}&action=review`;

    await emailService.sendMailDirect({
      to: financieraEmail,
      cc: cronograma.email_director,
      subject: `[VISTO BUENO ACADÉMICO] Cronograma de Práctica Integral de Movilidad - ${cronograma.programa_academico}`,
      html: emailService.renderInstitutionalTemplate({
        title: 'Aprobación Final de Cronograma de Práctica Integral de Movilidad',
        introHtml: `<p>Cordial Saludo de Paz y Bien,</p><p>Estimado <strong>Dr. Juan Carlos Nándar</strong>,<br/>Vicerrector Financiero y de Desarrollo Institucional,</p><p>La <strong>Vicerrectoría Académica</strong> (${user.nombre}) ha concedido el <strong>VISTO BUENO ACADÉMICO</strong> al Cronograma de Práctica Integral de Movilidad del programa <strong>${cronograma.programa_academico}</strong>.</p>`,
        bodyHtml: `
          <div style="margin: 18px 0; border: 1px solid #bbf7d0; border-radius: 12px; overflow: hidden; background: #ffffff; box-shadow: 0 4px 14px rgba(22, 101, 52, 0.06);">
            <div style="background: linear-gradient(135deg, #f0fdf4 0%, #f8fdf9 100%); border-bottom: 1px solid #bbf7d0; padding: 12px 18px;">
              <p style="margin: 0; font-weight: 800; color: #166534; letter-spacing: 0.02em;">Detalles de la Solicitud Evaluada</p>
            </div>
            <div style="padding: 16px 18px; color: #334155;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; font-weight: 700; color: #334155; width: 180px;">Código Cronograma:</td>
                  <td style="padding: 6px 0; color: #166534; font-weight: 800;">CRON-${cronograma.id}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: 700; color: #334155;">Programa Académico:</td>
                  <td style="padding: 6px 0; color: #0f172a;">${cronograma.programa_academico}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: 700; color: #334155;">Director Responsable:</td>
                  <td style="padding: 6px 0; color: #0f172a;">${cronograma.nombre_director} (${cronograma.email_director})</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: 700; color: #334155;">Visto Bueno Por:</td>
                  <td style="padding: 6px 0; color: #166534; font-weight: 700;">Vicerrectoría Académica (${user.nombre})</td>
                </tr>
              </table>
            </div>
          </div>
          <div style="text-align: center; margin-top: 24px;">
            <a href="${linkRevision}" target="_blank" rel="noopener noreferrer" style="display: inline-block; min-width: 250px; background: #059669; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 800; text-align: center; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);">
              Revisar y Aprobar Cronograma
            </a>
          </div>
        `
      })
    }).catch(err => console.error('Error enviando correo a Financiera:', err));

    return res.json({ message: 'Visto Bueno concedido y remitido a Vicerrectoría Financiera', cronograma });
  } catch (error) {
    console.error('Error en visto bueno académica:', error);
    return res.status(500).json({ error: error.message || 'Error procesando visto bueno' });
  }
};

// 7. Devolver a Corrección (Académica o Financiera)
const devolverACorreccion = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const { observaciones } = req.body;

    if (!observaciones || !observaciones.trim()) {
      return res.status(400).json({ error: 'Es obligatorio indicar las observaciones para devolver a corrección' });
    }

    const cronograma = await CronogramaMovilidad.findByPk(id);
    if (!cronograma) {
      return res.status(404).json({ error: 'Cronograma no encontrado' });
    }

    const trazabilidad = Array.isArray(cronograma.trazabilidad) ? [...cronograma.trazabilidad] : [];
    trazabilidad.push({
      event: 'devuelto_correccion',
      actor: { id: user.id, nombre: user.nombre, email: user.email },
      observaciones: observaciones.trim(),
      at: new Date()
    });

    await cronograma.update({
      estado: 'devuelto_correccion',
      observaciones_correccion: observaciones.trim(),
      trazabilidad
    });

    const linkCorreccion = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/practica-integral-movilidad?cronogramaId=${cronograma.id}&action=edit`;

    await emailService.sendMailDirect({
      to: cronograma.email_director,
      subject: `[CORRECCIÓN REQUERIDA] Cronograma de Práctica Integral de Movilidad - ${cronograma.programa_academico}`,
      html: emailService.renderInstitutionalTemplate({
        title: 'Devolución a Corrección de Cronograma de Movilidad',
        introHtml: `<p>Cordial Saludo de Paz y Bien,</p><p>Estimado(a) Director(a) <strong>${cronograma.nombre_director}</strong>,</p><p>Se le informa que la solicitud de <strong>Cronograma de Práctica Integral de Movilidad</strong> para el programa <strong>${cronograma.programa_academico}</strong> ha sido devuelta a corrección por <strong>${user.nombre}</strong>.</p>`,
        bodyHtml: `
          <div style="margin: 18px 0; border: 1px solid #fecaca; border-radius: 12px; overflow: hidden; background: #fff5f5; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.06);">
            <div style="background: linear-gradient(135deg, #fef2f2 0%, #fff5f5 100%); border-bottom: 1px solid #fecaca; padding: 12px 18px;">
              <p style="margin: 0; font-weight: 800; color: #dc2626; letter-spacing: 0.02em;">Instrucciones / Observaciones Registradas</p>
            </div>
            <div style="padding: 16px 18px; color: #991b1b; font-weight: 600; line-height: 1.6;">
              ${observaciones.trim()}
            </div>
          </div>
          <div style="text-align: center; margin-top: 24px;">
            <a href="${linkCorreccion}" target="_blank" rel="noopener noreferrer" style="display: inline-block; min-width: 250px; background: #dc2626; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 800; text-align: center; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.25);">
              Ingresar y Modificar Cronograma
            </a>
          </div>
        `
      })
    }).catch(err => console.error('Error enviando correo de corrección:', err));

    return res.json({ message: 'Cronograma devuelto a corrección', cronograma });
  } catch (error) {
    console.error('Error al devolver a corrección:', error);
    return res.status(500).json({ error: error.message || 'Error al devolver a corrección' });
  }
};

// 8. Aprobación Final por Vicerrectoría Financiera y Desarrollo Institucional
const aprobarFinanciera = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const cronograma = await CronogramaMovilidad.findByPk(id, {
      include: [{ model: CronogramaMovilidadActividad, as: 'actividades' }]
    });

    if (!cronograma) {
      return res.status(404).json({ error: 'Cronograma no encontrado' });
    }

    const trazabilidad = Array.isArray(cronograma.trazabilidad) ? [...cronograma.trazabilidad] : [];
    trazabilidad.push({
      event: 'aprobado_financiera',
      actor: { id: user.id, nombre: user.nombre, email: user.email },
      at: new Date()
    });

    await cronograma.update({
      estado: 'aprobado',
      aprobado_financiera_at: new Date(),
      aprobado_financiera_by: user.nombre,
      trazabilidad
    });

    // Re-generar PDF Final con las 4 Firmas Institucionales y Guardar
    const pdfBuffer = await cronogramaMovilidadPdfService.generateCronogramaPdfBuffer(cronograma, cronograma.actividades || []);
    const pdfFilename = `oficio_cronograma_${cronograma.id}_aprobado_${Date.now()}.pdf`;
    const uploadsDir = path.join(__dirname, '../../uploads/cronogramas');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const pdfFilePath = path.join(uploadsDir, pdfFilename);
    fs.writeFileSync(pdfFilePath, pdfBuffer);
    const pdfPublicPath = `/uploads/cronogramas/${pdfFilename}`;
    await cronograma.update({ pdf_oficio_path: pdfPublicPath });

    // Correos de Destinatarios Oficiales (Vicerrectoría Académica, Financiera, Director y Coordinador)
    const academicaEmail = process.env.VICERRECTORIA_ACADEMICA_EMAIL || 'vicerrectoria.academica@unicesmag.edu.co';
    const financieraEmail = process.env.VICERRECTORIA_FINANCIERA_EMAIL || 'jcnandar@unicesmag.edu.co';
    const directorEmail = cronograma.email_director;
    const coordEmail = cronograma.email_coordinador;

    const destinatariosOficiales = Array.from(new Set([
      directorEmail,
      coordEmail,
      academicaEmail,
      financieraEmail
    ].filter(Boolean)));

    const pdfFullUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}${pdfPublicPath}`;

    // Notificar aprobación final con adjunto de Oficio a todas las partes
    await emailService.sendMailDirect({
      to: destinatariosOficiales,
      subject: `[OFICIO APROBADO] Cronograma de Práctica Integral de Movilidad - ${cronograma.programa_academico}`,
      html: emailService.renderInstitutionalTemplate({
        title: 'Aprobación Institucional Final y Remisión de Oficio Oficial',
        introHtml: `<p>Cordial Saludo de Paz y Bien,</p><p>Estimadas Autoridades Institucionales y Dirección del Programa <strong>${cronograma.programa_academico}</strong>,</p><p>Nos complace informar que el <strong>Cronograma de Práctica Integral de Movilidad (CRON-${cronograma.id})</strong> ha sido <strong>APROBADO INSTITUCIONALMENTE</strong> por la Vicerrectoría Académica y la Vicerrectoría Financiera y de Desarrollo Institucional.</p>`,
        bodyHtml: `
          <div style="margin: 18px 0; border: 1px solid #bbf7d0; border-radius: 12px; overflow: hidden; background: #ffffff; box-shadow: 0 4px 14px rgba(22, 101, 52, 0.06);">
            <div style="background: linear-gradient(135deg, #f0fdf4 0%, #f8fdf9 100%); border-bottom: 1px solid #bbf7d0; padding: 12px 18px;">
              <p style="margin: 0; font-weight: 800; color: #166534; letter-spacing: 0.02em;">Estado: APROBADO, CONSERVADO Y HABILITADO</p>
            </div>
            <div style="padding: 16px 18px; color: #334155;">
              <p style="margin: 0 0 10px 0;">Se adjunta a este comunicado el <strong>Oficio Oficial Firmado Electrónicamente (PDF)</strong> con trazabilidad SHA-256 e integración de firmas de la Dirección del Programa, Coordinación de Práctica, Vicerrectoría Académica y Vicerrectoría Financiera.</p>
              <p style="margin: 0;">Las actividades registradas en el cronograma han quedado activas. Los docentes y tutores responsables asignados ya tienen habilitada la opción en su formulario de Reporte de Salida para seleccionar su actividad y radicar con 1 solo clic.</p>
            </div>
          </div>
          <div style="text-align: center; margin-top: 24px;">
            <a href="${pdfFullUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; min-width: 260px; background: #15803d; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 800; text-align: center; box-shadow: 0 4px 12px rgba(21, 128, 61, 0.25);">
              Descargar / Visualizar Oficio Aprobado PDF
            </a>
          </div>
        `
      }),
      attachments: [{
        filename: `Oficio_Aprobado_CRON_${cronograma.id}_${cronograma.programa_academico.replace(/\s+/g, '_')}.pdf`,
        path: pdfFilePath
      }]
    }).catch(err => console.error('Error enviando correo de aprobación final:', err));

    return res.json({ message: 'Cronograma aprobado satisfactoriamente', cronograma });
  } catch (error) {
    console.error('Error al aprobar por financiera:', error);
    return res.status(500).json({ error: error.message || 'Error al aprobar cronograma' });
  }
};

// 9. Buscar Estudiantes Matriculados
const buscarEstudiantesMatriculados = async (req, res) => {
  try {
    const { query, programa, limit = 50 } = req.query;
    let whereConditions = [];

    if (query && query.trim()) {
      const q = `%${query.trim()}%`;
      whereConditions.push({
        [Op.or]: [
          { primer_nombre: { [Op.iLike]: q } },
          { segundo_nombre: { [Op.iLike]: q } },
          { primer_apellido: { [Op.iLike]: q } },
          { segundo_apellido: { [Op.iLike]: q } },
          { numero_documento: { [Op.iLike]: q } },
          { codigo_estudiante: { [Op.iLike]: q } }
        ]
      });
    }

    if (programa && programa.trim() && programa.trim() !== 'TODOS') {
      whereConditions.push({
        programa: { [Op.iLike]: `%${programa.trim()}%` }
      });
    }

    const estudiantes = await PoblacionalMatriculado.findAll({
      where: whereConditions.length > 0 ? { [Op.and]: whereConditions } : {},
      attributes: ['id', 'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido', 'numero_documento', 'codigo_estudiante', 'programa', 'semestre'],
      order: [['primer_apellido', 'ASC'], ['primer_nombre', 'ASC']],
      limit: Number(limit)
    });

    const resultado = estudiantes.map((e) => ({
      id: e.id,
      nombre_completo: `${e.primer_nombre || ''} ${e.segundo_nombre || ''} ${e.primer_apellido || ''} ${e.segundo_apellido || ''}`.replace(/\s+/g, ' ').trim(),
      numero_documento: e.numero_documento,
      codigo_estudiante: e.codigo_estudiante,
      programa: e.programa,
      semestre: e.semestre
    }));

    const distinctProgs = await PoblacionalMatriculado.findAll({
      attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('programa')), 'programa']],
      raw: true
    });
    const programas = distinctProgs.map(p => p.programa).filter(Boolean).sort();

    return res.json({ estudiantes: resultado, programas });
  } catch (error) {
    console.error('Error al buscar estudiantes:', error);
    return res.status(500).json({ error: 'Error al consultar la base de datos de matriculados' });
  }
};

// 10. Buscar Responsables (Usuarios/Docentes)
const buscarResponsables = async (req, res) => {
  try {
    const { query, dependencia, limit = 1000 } = req.query;
    let whereConditions = [];

    // Incluir usuarios activos (soporta 'activo', 'ACTIVO' o no inactivos)
    whereConditions.push({
      [Op.or]: [
        { estado: 'activo' },
        { estado: 'ACTIVO' },
        { estado: null },
        Sequelize.where(Sequelize.fn('LOWER', Sequelize.cast(Sequelize.col('estado'), 'text')), { [Op.ne]: 'inactivo' })
      ]
    });

    if (query && query.trim()) {
      const q = `%${query.trim()}%`;
      whereConditions.push({
        [Op.or]: [
          { nombre: { [Op.iLike]: q } },
          { email: { [Op.iLike]: q } },
          { cargo: { [Op.iLike]: q } },
          { dependencia: { [Op.iLike]: q } }
        ]
      });
    }

    if (dependencia && dependencia.trim() && dependencia !== 'TODOS') {
      whereConditions.push({
        dependencia: { [Op.iLike]: `%${dependencia.trim()}%` }
      });
    }

    const usuarios = await User.findAll({
      where: { [Op.and]: whereConditions },
      attributes: ['id', 'nombre', 'email', 'cargo', 'dependencia'],
      order: [['nombre', 'ASC']],
      limit: Number(limit)
    });

    const distinctDeps = await User.findAll({
      attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('dependencia')), 'dependencia']],
      raw: true
    });

    const dependencias = distinctDeps.map(d => d.dependencia).filter(Boolean).sort();

    return res.json({ usuarios, dependencias });
  } catch (error) {
    console.error('Error al buscar responsables:', error);
    return res.status(500).json({ error: 'Error al buscar responsables' });
  }
};

// 11. Mis Actividades Asignadas (Docente)
const misActividadesAsignadas = async (req, res) => {
  try {
    const user = req.user;
    const userEmailLower = user.email ? user.email.toLowerCase() : '';
    const userNombreLower = user.nombre ? user.nombre.toLowerCase() : '';

    const cronogramasAprobados = await CronogramaMovilidad.findAll({
      where: { estado: 'aprobado' },
      include: [{ model: CronogramaMovilidadActividad, as: 'actividades' }]
    });

    const todayStr = new Date().toISOString().split('T')[0];
    const misActividades = [];
    cronogramasAprobados.forEach((crono) => {
      (crono.actividades || []).forEach((act) => {
        if (act.estado_actividad === 'programada' || act.estado_actividad === 'en_ejecucion') {
          // Descartar actividades cuya fecha de regreso ya expiró
          if (act.fecha_regreso && act.fecha_regreso < todayStr) {
            return;
          }

          const esResponsable = Array.isArray(act.responsables) && act.responsables.some((r) => {
            const rEmail = (r.email || '').toLowerCase();
            const rNombre = (r.nombre || '').toLowerCase();
            return rEmail === userEmailLower || (rNombre && userNombreLower.includes(rNombre));
          });

          if (esResponsable) {
            misActividades.push({
              id_actividad: act.id,
              id_cronograma: crono.id,
              programa: crono.programa_academico,
              fecha_salida: act.fecha_salida,
              fecha_regreso: act.fecha_regreso,
              hora_salida: act.hora_salida || '06:00 AM',
              hora_regreso: act.hora_regreso || '06:00 PM',
              requiere_viaticos: act.requiere_viaticos !== false,
              alojamiento: act.alojamiento || 'Hotel / Hospedaje en destino',
              transporte: act.transporte || 'Terrestre Intermunicipal',
              funciones: act.funciones,
              localidad_texto: act.localidad_texto,
              contexto_practica: act.contexto_practica,
              alcance: act.alcance,
              pais: act.pais,
              departamento: act.departamento,
              municipio: act.municipio,
              responsables: act.responsables,
              estudiantes: act.estudiantes
            });
          }
        }
      });
    });

    return res.json({ actividades: misActividades });
  } catch (error) {
    console.error('Error al consultar actividades asignadas:', error);
    return res.status(500).json({ error: 'Error al consultar actividades asignadas' });
  }
};

// 12. Marcar Actividad como Cumplida
const marcarActividadCumplida = async (req, res) => {
  try {
    const { id } = req.params;
    const actividad = await CronogramaMovilidadActividad.findByPk(id);

    if (!actividad) {
      return res.status(404).json({ error: 'Actividad no encontrada' });
    }

    await actividad.update({ estado_actividad: 'cumplida' });

    // Verificar si todas las actividades del cronograma están cumplidas
    const restantes = await CronogramaMovilidadActividad.count({
      where: {
        id_cronograma: actividad.id_cronograma,
        estado_actividad: { [Op.ne]: 'cumplida' }
      }
    });

    if (restantes === 0) {
      await CronogramaMovilidad.update({ estado: 'cumplido' }, { where: { id: actividad.id_cronograma } });
    }

    return res.json({ message: 'Actividad marcada como cumplida', actividad });
  } catch (error) {
    console.error('Error al marcar actividad cumplida:', error);
    return res.status(500).json({ error: 'Error al actualizar estado de actividad' });
  }
};

// 13. Eliminar Cronograma (Director en Borrador | Vicerrectoría Académica en Cualquier Estado)
const eliminarCronograma = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    const cronograma = await CronogramaMovilidad.findByPk(id);
    if (!cronograma) {
      return res.status(404).json({ error: 'Cronograma no encontrado' });
    }

    const isAcademica = (user.cargo && /academica/i.test(user.cargo)) || (user.dependencia && /academica/i.test(user.dependencia)) || user.role === 'administrador';
    const isDirector = (user.cargo && /director/i.test(user.cargo)) || (user.dependencia && /licenciatura|programa/i.test(user.dependencia));

    // El Director sólo puede borrar si está en estado borrador
    if (!isAcademica && isDirector && cronograma.estado !== 'borrador') {
      return res.status(403).json({ error: 'El Director solo puede eliminar cronogramas en estado Borrador.' });
    }

    // Si no es Vicerrectoría Académica ni Director en borrador, denegar
    if (!isAcademica && !isDirector) {
      return res.status(403).json({ error: 'No tienes permisos para eliminar este cronograma.' });
    }

    // Eliminar actividades asociadas y el cronograma
    await CronogramaMovilidadActividad.destroy({ where: { id_cronograma: cronograma.id } });
    await cronograma.destroy();

    return res.json({ message: 'Cronograma eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar cronograma:', error);
    return res.status(500).json({ error: error.message || 'Error al eliminar el cronograma' });
  }
};

module.exports = {
  crearOBorrador,
  obtenerCronogramas,
  obtenerPorId,
  actualizarCronograma,
  radicarCronograma,
  vistoBuenoAcademica,
  devolverACorreccion,
  aprobarFinanciera,
  buscarEstudiantesMatriculados,
  buscarResponsables,
  misActividadesAsignadas,
  marcarActividadCumplida,
  eliminarCronograma
};
