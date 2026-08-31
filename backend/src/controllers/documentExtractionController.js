const { extractDocumentInformation } = require('../services/documentExtractionService');

const extractDocument = async (req, res) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length === 0) {
      return res.status(400).json({ success: false, message: 'Selecciona uno o varios PDF o imagenes para procesar.' });
    }

    const instructions = String(req.body?.instrucciones || '').trim().slice(0, 1200);
    const results = [];

    // Process in small groups to avoid exhausting provider quotas and memory.
    for (let index = 0; index < files.length; index += 2) {
      const group = files.slice(index, index + 2);
      const settled = await Promise.allSettled(group.map((file) => extractDocumentInformation({
        buffer: file.buffer,
        mimeType: file.mimetype,
        originalName: file.originalname,
        instructions
      })));

      settled.forEach((item, groupIndex) => {
        const file = group[groupIndex];
        if (item.status === 'fulfilled') {
          results.push({
            archivo: { nombre: file.originalname, tipo: file.mimetype, tamano: file.size },
            estado: item.value.advertencias.length > 0 || item.value.campos.some((field) => field.confianza < 60) ? 'Revisar' : 'Procesado',
            resultado: item.value,
            error: null
          });
        } else {
          results.push({
            archivo: { nombre: file.originalname, tipo: file.mimetype, tamano: file.size },
            estado: 'Error',
            resultado: null,
            error: item.reason?.message || 'No fue posible procesar este archivo.'
          });
        }
      });
    }

    const stats = {
      total: results.length,
      procesados: results.filter((item) => item.estado === 'Procesado').length,
      revisar: results.filter((item) => item.estado === 'Revisar').length,
      errores: results.filter((item) => item.estado === 'Error').length
    };

    return res.json({
      success: true,
      resultados: results,
      stats,
      persistido: false
    });
  } catch (error) {
    console.error('[documentExtraction]', error?.code || error?.message);
    return res.status(Number(error?.status) || 500).json({
      success: false,
      code: error?.code || 'DOCUMENT_EXTRACTION_ERROR',
      message: error?.message || 'No fue posible procesar el documento.'
    });
  }
};

module.exports = { extractDocument };
