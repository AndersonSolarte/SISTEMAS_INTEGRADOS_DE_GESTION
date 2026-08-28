const { getDependencyEmail } = require('./dependencyEmails');

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const getDesplazamientoViaticosRecipients = () => ({
  academica: normalizeEmail(
    process.env.VIATICOS_VICERRECTORIA_ACADEMICA_EMAIL
      || getDependencyEmail('Vicerrectoria Academica')
      || 'viceacad@unicesmag.edu.co'
  ),
  investigacion: normalizeEmail(
    process.env.VIATICOS_VICERRECTORIA_INVESTIGACION_EMAIL
      || 'jajimenez@unicesmag.edu.co'
  ),
  evangelizacion: normalizeEmail(
    process.env.VIATICOS_VICERRECTORIA_EVANGELIZACION_EMAIL
      || getDependencyEmail('Vicerrectoria para la Evangelizacion de las Culturas')
      || 'vicebien@unicesmag.edu.co'
  ),
  financiera: normalizeEmail(
    process.env.VIATICOS_VICERRECTORIA_FINANCIERA_EMAIL
      || 'jcnandar@unicesmag.edu.co'
  ),
  financieraInstitucional: normalizeEmail(
    process.env.VIATICOS_VICERRECTORIA_FINANCIERA_INSTITUCIONAL_EMAIL
      || getDependencyEmail('Vicerrectoria Financiera y de Desarrollo Institucional')
      || 'viceadfin@unicesmag.edu.co'
  ),
  sst: normalizeEmail(
    process.env.VIATICOS_SST_EMAIL
      || getDependencyEmail('Oficina de Seguridad y Salud en el Trabajo')
      || 'seguridadysalud@unicesmag.edu.co'
  ),
  rectoria: normalizeEmail(
    process.env.VIATICOS_RECTORIA_EMAIL
      || getDependencyEmail('Rectoria')
      || 'rectoria@unicesmag.edu.co'
  ),
  gestionHumana: normalizeEmail(
    process.env.VIATICOS_GESTION_HUMANA_EMAIL
      || getDependencyEmail('Oficina de Gestion del Talento Humano')
      || 'gestionhumana@unicesmag.edu.co'
  ),
  tecnicoContable: normalizeEmail(
    process.env.VIATICOS_TECNICO_CONTABLE_EMAIL || 'tecnico.viceadfin@unicesmag.edu.co'
  ),
  tesoreria: normalizeEmail(
    process.env.VIATICOS_TESORERIA_EMAIL || 'pagador@unicesmag.edu.co'
  )
});

module.exports = { getDesplazamientoViaticosRecipients, normalizeEmail };
