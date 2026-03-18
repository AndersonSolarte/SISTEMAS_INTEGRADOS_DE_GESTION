const { DocumentoFavorito, Documento, TipoDocumentacion } = require('../models');

const listFavorites = async (req, res) => {
  try {
    const favoritos = await DocumentoFavorito.findAll({
      where: { user_id: req.user.id },
      include: [
        {
          model: Documento,
          as: 'documento',
          include: [
            {
              model: TipoDocumentacion,
              as: 'tipoDocumentacion',
              attributes: ['id', 'nombre']
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    return res.json({
      success: true,
      data: { favoritos }
    });
  } catch (error) {
    console.error('Error al listar favoritos:', error);
    return res.status(500).json({ success: false, message: 'Error al listar favoritos' });
  }
};

const listFavoriteIds = async (req, res) => {
  try {
    const favoritos = await DocumentoFavorito.findAll({
      where: { user_id: req.user.id },
      attributes: ['documento_id']
    });

    return res.json({
      success: true,
      data: { ids: favoritos.map((f) => f.documento_id) }
    });
  } catch (error) {
    console.error('Error al listar ids de favoritos:', error);
    return res.status(500).json({ success: false, message: 'Error al listar favoritos' });
  }
};

const addFavorite = async (req, res) => {
  try {
    const documentoId = Number(req.params.documentoId || req.body.documento_id);
    if (!documentoId) {
      return res.status(400).json({ success: false, message: 'Documento invalido' });
    }

    const existing = await DocumentoFavorito.findOne({
      where: { user_id: req.user.id, documento_id: documentoId }
    });

    if (existing) {
      return res.json({ success: true, data: { favorito: existing }, message: 'Ya esta en favoritos' });
    }

    const favorito = await DocumentoFavorito.create({
      user_id: req.user.id,
      documento_id: documentoId
    });

    return res.json({ success: true, data: { favorito }, message: 'Agregado a favoritos' });
  } catch (error) {
    console.error('Error al agregar favorito:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al agregar favorito',
      detail: error?.message
    });
  }
};

const removeFavorite = async (req, res) => {
  try {
    const documentoId = Number(req.params.documentoId || req.body.documento_id);
    if (!documentoId) {
      return res.status(400).json({ success: false, message: 'Documento invalido' });
    }

    const deleted = await DocumentoFavorito.destroy({
      where: { user_id: req.user.id, documento_id: documentoId }
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Favorito no encontrado' });
    }

    return res.json({ success: true, message: 'Favorito eliminado' });
  } catch (error) {
    console.error('Error al eliminar favorito:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al eliminar favorito',
      detail: error?.message
    });
  }
};

module.exports = {
  listFavorites,
  listFavoriteIds,
  addFavorite,
  removeFavorite
};
