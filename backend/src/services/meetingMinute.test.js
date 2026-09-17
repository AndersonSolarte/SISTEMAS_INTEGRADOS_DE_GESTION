const assert = require('node:assert/strict');
const test = require('node:test');
const { isMeetingMinuteDocument } = require('../config/meetingMinuteConfig');
const { generateActaBuffer } = require('./actaExportService');

test('reconoce el formato institucional de asistencia y reunión', () => {
  assert.equal(isMeetingMinuteDocument({ codigo: 'COM-ID-FR-002', titulo: 'REGISTRO DE ASISTENCIA Y REUNIÓN' }), true);
  assert.equal(isMeetingMinuteDocument({ codigo: 'THM-DP-FR-002', titulo: 'REPORTE DE SALIDA' }), false);
});

test('genera el documento Word con encabezado dinámico', async () => {
  const buffer = await generateActaBuffer({
    header: { codigo: 'COM-ID-FR-002', version: '1', fecha: '06/02/2020' },
    responsables: 'Área responsable',
    dependencia: 'Dependencia que cita',
    participantes: [{ nombre: 'Participante', cargo: 'Cargo', firma: 'Pendiente · QR' }],
    objetivo: ['Objetivo'],
    desarrollo: ['Desarrollo'],
    conclusiones: ['Compromiso']
  });
  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 1000);
});

test('exporta contenido enriquecido y tablas del acta', async () => {
  const buffer = await generateActaBuffer({
    header: { codigo: 'COM-ID-FR-002', version: '1', fecha: '16/09/2026' },
    fecha: '16/09/2026',
    objetivo: ['<h3 style="text-align:center">Objetivo institucional</h3><p><strong>Texto destacado</strong> con <u>subrayado</u> y <a href="https://www.unicesmag.edu.co" target="_blank" rel="noopener noreferrer">enlace institucional</a>.</p>'],
    desarrollo: ['<ul><li>Primer asunto</li><li>Segundo asunto</li></ul><table><tbody><tr><th>Compromiso</th><th>Responsable</th><th>Fecha</th></tr><tr><td>Entregar informe</td><td>Planeación</td><td>30/09/2026</td></tr><tr><td>Revisar resultados</td><td>Calidad</td><td>15/10/2026</td></tr></tbody></table>'],
    conclusiones: ['<ol><li>Primer acuerdo</li><li>Segundo acuerdo</li></ol>']
  });
  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 1500);
});
