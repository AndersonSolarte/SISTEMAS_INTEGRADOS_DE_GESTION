const formatConsentDate = (value) => new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
}).format(new Date(value));

const buildSaludConsentimientoPdfSection = (solicitud) => {
  const data = solicitud?.datos_formulario || {};
  const record = data.consentimiento_salud;
  // Los documentos anteriores conservan su evidencia original: no se presume aceptación.
  if (!record?.accepted || !record.policy) return [];
  const { policy, actor } = record;
  return [
    { text: policy.title, bold: true, fontSize: 11, pageBreak: 'before', margin: [0, 0, 0, 12] },
    ...policy.paragraphs.map((text) => ({ text, fontSize: 10, alignment: 'justify', margin: [0, 0, 0, 10] })),
    {
      unbreakable: true,
      stack: [
        { text: policy.declarationTitle, bold: true, margin: [0, 4, 0, 8] },
        { text: `[X] ${policy.declaration}`, margin: [0, 0, 0, 10] },
        { text: `Nombre: ${actor.nombre}` },
        { text: `Documento de identidad: ${actor.documento}` },
        { text: `Firma: aceptación electrónica mediante ${record.method}` },
        { text: `Cuenta institucional: ${actor.correo}` },
        { text: `Fecha: ${formatConsentDate(record.acceptedAt)} (America/Bogota)` },
        { text: `Solicitud: ${solicitud.consecutivo || solicitud.id || ''}` },
        { text: `ID de transacción del reporte: ${data.tx_id || ''}`, fontSize: 8 },
        { text: `ID de aceptación: ${record.transactionId}`, fontSize: 8 },
        { text: `Versión del texto: ${policy.version}`, fontSize: 8 },
        { text: `SHA-256 del texto: ${policy.hash}`, fontSize: 7 },
        { text: `SHA-256 de la evidencia: ${record.evidenceHash}`, fontSize: 7 }
      ],
      fontSize: 9
    }
  ];
};

module.exports = { buildSaludConsentimientoPdfSection };
