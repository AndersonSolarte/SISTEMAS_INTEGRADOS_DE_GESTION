const { listEvidenceFiles } = require('../services/googleDriveEvidenceService');

const listarEvidencias = async (req, res) => {
  try {
    const files = await listEvidenceFiles(req.query.folderUrl);
    return res.json(files);
  } catch (error) {
    const status = Number(error?.statusCode || error?.code || error?.response?.status || 500);
    const googleMessage = error?.response?.data?.error?.message;
    return res.status(status >= 400 && status < 600 ? status : 500).json({
      success: false,
      message: googleMessage || error.message || 'No se pudieron cargar las evidencias de Google Drive'
    });
  }
};

module.exports = {
  listarEvidencias
};
