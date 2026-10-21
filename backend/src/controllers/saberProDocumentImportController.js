const service = require('../services/saberProDocumentImportService');

function handleError(res, error) {
  console.error('[saberProDocumentImport]', error?.code || error?.message);
  return res.status(Number(error?.status) || 500).json({
    success: false,
    code: error?.code || 'SABER_PRO_DOCUMENT_IMPORT_ERROR',
    message: error?.message || 'No fue posible procesar la consulta documental.'
  });
}

async function createImport(req, res) {
  try {
    const result = await service.createImport(req.file, req.user?.id);
    return res.status(202).json({ success: true, data: result });
  } catch (error) {
    return handleError(res, error);
  }
}

async function latestImport(req, res) {
  try {
    return res.json({ success: true, data: await service.getLatestImport(req.user?.id) });
  } catch (error) {
    return handleError(res, error);
  }
}

async function getImport(req, res) {
  try {
    const result = await service.getImport(req.params.id, req.user?.id);
    if (!result) return res.status(404).json({ success: false, message: 'La consulta no existe.' });
    return res.json({ success: true, data: result });
  } catch (error) {
    return handleError(res, error);
  }
}

async function retryImport(req, res) {
  try {
    return res.status(202).json({ success: true, data: await service.retryImport(req.params.id, req.user?.id) });
  } catch (error) {
    return handleError(res, error);
  }
}

async function resumeImport(req, res) {
  try {
    const result = await service.resumeImport(req.params.id, req.user?.id);
    return res.status(result.resumed ? 202 : 200).json({ success: true, data: result });
  } catch (error) {
    return handleError(res, error);
  }
}

async function clearImports(req, res) {
  try {
    const result = await service.clearImports(req.user?.id);
    return res.json({
      success: true,
      data: result,
      message: 'La consulta temporal fue eliminada de SIAC.'
    });
  } catch (error) {
    return handleError(res, error);
  }
}

async function correctItem(req, res) {
  try {
    const result = await service.correctItem(req.params.itemId, req.body || {}, req.user?.id);
    return res.json({ success: true, data: result });
  } catch (error) {
    return handleError(res, error);
  }
}

async function viewPdf(req, res) {
  try {
    const buffer = await service.getItemPdf(req.params.itemId, req.user?.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="documento-${req.params.itemId}.pdf"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(buffer);
  } catch (error) {
    return handleError(res, error);
  }
}

async function downloadTemplate(_req, res) {
  try {
    const buffer = await service.createTemplateWorkbook();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla_consulta_documental.xlsx"');
    return res.send(Buffer.from(buffer));
  } catch (error) {
    return handleError(res, error);
  }
}

async function exportImport(req, res) {
  try {
    const buffer = await service.createResultWorkbook(req.params.id, req.user?.id);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="consulta_documental_${req.params.id}.xlsx"`);
    return res.send(Buffer.from(buffer));
  } catch (error) {
    return handleError(res, error);
  }
}

module.exports = {
  createImport,
  latestImport,
  getImport,
  retryImport,
  resumeImport,
  clearImports,
  correctItem,
  viewPdf,
  downloadTemplate,
  exportImport
};
