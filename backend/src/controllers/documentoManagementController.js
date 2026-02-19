const { Documento, SubProceso, Proceso, MacroProceso, TipoDocumentacion, User } = require('../models');
const { Op } = require('sequelize');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuración de multer para subida de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/documentos');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos PDF'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// CREAR DOCUMENTO
const createDocumento = async (req, res) => {
  try {
    const {
      codigo,
      titulo,
      version,
      subproceso_id,
      tipo_documentacion_id,
      estado,
      fecha_creacion,
      revisa,
      aprueba,
      fecha_aprobacion,
      autor
    } = req.body;

    // Validar campos obligatorios
    if (!codigo || !titulo || !version || !subproceso_id || !tipo_documentacion_id || !estado) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos obligatorios: código, título, versión, subproceso, tipo de documento y estado'
      });
    }

    // Validar archivo
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Debe adjuntar un archivo PDF'
      });
    }

    // Verificar código único
    const existente = await Documento.findOne({ where: { codigo, eliminado: false } });
    if (existente) {
      // Eliminar archivo subido
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'El código del documento ya existe'
      });
    }

    // Validar subproceso existe
    const subproceso = await SubProceso.findByPk(subproceso_id);
    if (!subproceso) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Subproceso no encontrado'
      });
    }

    // Validar tipo de documentación existe
    const tipoDoc = await TipoDocumentacion.findByPk(tipo_documentacion_id);
    if (!tipoDoc) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Tipo de documentación no encontrado'
      });
    }

    // Crear documento
    const documento = await Documento.create({
      codigo,
      titulo,
      version,
      subproceso_id,
      tipo_documentacion_id,
      estado,
      fecha_creacion,
      revisa,
      aprueba,
      fecha_aprobacion,
      autor,
      link_acceso: `/uploads/documentos/${req.file.filename}`,
      creado_por: req.user.id
    });

    // Obtener documento con relaciones
    const documentoCompleto = await Documento.findByPk(documento.id, {
      include: [
        {
          model: SubProceso,
          as: 'subproceso',
          include: [{
            model: Proceso,
            as: 'proceso',
            include: [{ model: MacroProceso, as: 'macroProceso' }]
          }]
        },
        { model: TipoDocumentacion, as: 'tipoDocumentacion' }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Documento creado exitosamente',
      data: { documento: documentoCompleto }
    });
  } catch (error) {
    console.error('Error al crear documento:', error);
    // Limpiar archivo si hubo error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: 'Error al crear documento'
    });
  }
};

// LISTAR DOCUMENTOS (con eliminados lógicos excluidos por defecto)
const getDocumentosManagement = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', incluirEliminados = false } = req.query;
    const offset = (page - 1) * limit;

    const where = { eliminado: incluirEliminados === 'true' ? undefined : false };

    if (search) {
      where[Op.or] = [
        { codigo: { [Op.iLike]: `%${search}%` } },
        { titulo: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows } = await Documento.findAndCountAll({
      where,
      include: [
        {
          model: SubProceso,
          as: 'subproceso',
          include: [{
            model: Proceso,
            as: 'proceso',
            include: [{ model: MacroProceso, as: 'macroProceso' }]
          }]
        },
        { model: TipoDocumentacion, as: 'tipoDocumentacion' }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']],
      distinct: true
    });

    res.json({
      success: true,
      data: {
        documentos: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error al listar documentos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al listar documentos'
    });
  }
};

// OBTENER UN DOCUMENTO
const getDocumento = async (req, res) => {
  try {
    const { id } = req.params;

    const documento = await Documento.findOne({
      where: { id, eliminado: false },
      include: [
        {
          model: SubProceso,
          as: 'subproceso',
          include: [{
            model: Proceso,
            as: 'proceso',
            include: [{ model: MacroProceso, as: 'macroProceso' }]
          }]
        },
        { model: TipoDocumentacion, as: 'tipoDocumentacion' },
        { model: User, as: 'creador', attributes: ['id', 'nombre', 'email'] }
      ]
    });

    if (!documento) {
      return res.status(404).json({
        success: false,
        message: 'Documento no encontrado'
      });
    }

    res.json({
      success: true,
      data: { documento }
    });
  } catch (error) {
    console.error('Error al obtener documento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener documento'
    });
  }
};

// ACTUALIZAR DOCUMENTO
const updateDocumento = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      codigo,
      titulo,
      version,
      subproceso_id,
      tipo_documentacion_id,
      estado,
      fecha_creacion,
      revisa,
      aprueba,
      fecha_aprobacion,
      autor
    } = req.body;

    const documento = await Documento.findOne({ where: { id, eliminado: false } });

    if (!documento) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        message: 'Documento no encontrado'
      });
    }

    // Verificar código único (si cambió)
    if (codigo && codigo !== documento.codigo) {
      const existente = await Documento.findOne({
        where: {
          codigo,
          id: { [Op.ne]: id },
          eliminado: false
        }
      });

      if (existente) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: 'El código del documento ya existe'
        });
      }
    }

    // Si hay nuevo archivo, eliminar el anterior
    if (req.file) {
      const oldFilePath = path.join(__dirname, '../../', documento.link_acceso);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    // Actualizar documento
    await documento.update({
      codigo: codigo || documento.codigo,
      titulo: titulo || documento.titulo,
      version: version || documento.version,
      subproceso_id: subproceso_id || documento.subproceso_id,
      tipo_documentacion_id: tipo_documentacion_id || documento.tipo_documentacion_id,
      estado: estado || documento.estado,
      fecha_creacion: fecha_creacion || documento.fecha_creacion,
      revisa: revisa || documento.revisa,
      aprueba: aprueba || documento.aprueba,
      fecha_aprobacion: fecha_aprobacion || documento.fecha_aprobacion,
      autor: autor || documento.autor,
      link_acceso: req.file ? `/uploads/documentos/${req.file.filename}` : documento.link_acceso,
      actualizado_por: req.user.id
    });

    // Obtener documento actualizado con relaciones
    const documentoActualizado = await Documento.findByPk(id, {
      include: [
        {
          model: SubProceso,
          as: 'subproceso',
          include: [{
            model: Proceso,
            as: 'proceso',
            include: [{ model: MacroProceso, as: 'macroProceso' }]
          }]
        },
        { model: TipoDocumentacion, as: 'tipoDocumentacion' }
      ]
    });

    res.json({
      success: true,
      message: 'Documento actualizado exitosamente',
      data: { documento: documentoActualizado }
    });
  } catch (error) {
    console.error('Error al actualizar documento:', error);
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar documento'
    });
  }
};

// ELIMINAR DOCUMENTO (lógico)
const deleteDocumento = async (req, res) => {
  try {
    const { id } = req.params;

    const documento = await Documento.findOne({ where: { id, eliminado: false } });

    if (!documento) {
      return res.status(404).json({
        success: false,
        message: 'Documento no encontrado'
      });
    }

    // Eliminación lógica
    await documento.update({
      eliminado: true,
      eliminado_por: req.user.id,
      eliminado_en: new Date()
    });

    res.json({
      success: true,
      message: 'Documento eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar documento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar documento'
    });
  }
};

// RESTAURAR DOCUMENTO
const restoreDocumento = async (req, res) => {
  try {
    const { id } = req.params;

    const documento = await Documento.findOne({ where: { id, eliminado: true } });

    if (!documento) {
      return res.status(404).json({
        success: false,
        message: 'Documento no encontrado'
      });
    }

    await documento.update({
      eliminado: false,
      eliminado_por: null,
      eliminado_en: null
    });

    res.json({
      success: true,
      message: 'Documento restaurado exitosamente'
    });
  } catch (error) {
    console.error('Error al restaurar documento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al restaurar documento'
    });
  }
};

// DESCARGAR DOCUMENTO
const downloadDocumento = async (req, res) => {
  try {
    const { id } = req.params;

    const documento = await Documento.findOne({ where: { id, eliminado: false } });

    if (!documento) {
      return res.status(404).json({
        success: false,
        message: 'Documento no encontrado'
      });
    }

    const filePath = path.join(__dirname, '../../', documento.link_acceso);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Archivo no encontrado en el servidor'
      });
    }

    res.download(filePath, `${documento.codigo}_${documento.titulo}.pdf`);
  } catch (error) {
    console.error('Error al descargar documento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al descargar documento'
    });
  }
};

module.exports = {
  upload,
  createDocumento,
  getDocumentosManagement,
  getDocumento,
  updateDocumento,
  deleteDocumento,
  restoreDocumento,
  downloadDocumento
};