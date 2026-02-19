const { User, Documento } = require('../models');
const { Op } = require('sequelize');
const crypto = require('crypto');
const { sendWelcomeEmail, sendPasswordResetEmail, sendTemporaryPasswordEmail } = require('../services/emailService');
const XLSX = require('xlsx');
const fs = require('fs');

// Validar dominio institucional
const validarDominio = (email) => {
  const regex = /^[a-zA-Z0-9._%+-]+@unicesmag\.edu\.co$/;
  return regex.test(email);
};

const validarEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

// Generar contraseña temporal
const generarPasswordTemporal = () => {
  return crypto.randomBytes(8).toString('hex');
};

const slugify = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '');

const generarUsernameUnico = async (username, email) => {
  const fromUsername = slugify(username);
  const fromEmail = slugify((email || '').split('@')[0]);
  const base = fromUsername || fromEmail || `usuario${Date.now()}`;

  let candidate = base;
  let counter = 1;

  while (await User.findOne({ where: { username: candidate } })) {
    candidate = `${base}${counter}`;
    counter += 1;
  }

  return candidate;
};

// CREAR USUARIO INDIVIDUAL
const createUser = async (req, res) => {
  try {
    const { nombre, email, username, role } = req.body;
    const cleanEmail = String(email || '').trim().toLowerCase();
    
    // Validar dominio
    if (!validarDominio(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: 'El correo debe pertenecer al dominio @unicesmag.edu.co'
      });
    }

    if (!nombre || !cleanEmail) {
      return res.status(400).json({
        success: false,
        message: 'Nombre y correo son obligatorios'
      });
    }

    const usernameFinal = await generarUsernameUnico(username, cleanEmail);
    
    // Verificar duplicados
    const existente = await User.findOne({
      where: {
        [Op.or]: [{ email: cleanEmail }, { username: usernameFinal }]
      }
    });
    
    if (existente) {
      return res.status(400).json({
        success: false,
        message: existente.email === email ? 'El correo ya está registrado' : 'El usuario ya existe'
      });
    }
    
    // Generar contraseña temporal
    const tempPassword = generarPasswordTemporal();
    
    // Crear usuario
    const user = await User.create({
      nombre,
      email: cleanEmail,
      username: usernameFinal,
      password: tempPassword,
      role: role || 'consulta',
      estado: 'activo',
      must_change_password: true
    });
    
    // Enviar email de bienvenida con credenciales temporales
    const emailResult = await sendWelcomeEmail(user, tempPassword);

    if (!emailResult.success) {
      // Modo contingencia: el usuario queda creado y se entrega temporal manualmente
      return res.status(201).json({
        success: true,
        message: 'Usuario creado, pero falló el envío de correo de bienvenida. Entrega la contraseña temporal manualmente.',
        data: {
          user,
          emailEnviado: false,
          passwordTemporal: tempPassword,
          errorEmail: emailResult.error
        }
      });
    }

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente. Se enviaron credenciales temporales al correo institucional.',
      data: { user, emailEnviado: true }
    });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear usuario'
    });
  }
};

// LISTAR USUARIOS
const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', role = '' } = req.query;
    const offset = (page - 1) * limit;
    
    const where = {};
    
    if (search) {
      where[Op.or] = [
        { nombre: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { username: { [Op.iLike]: `%${search}%` } }
      ];
    }
    
    if (role) {
      where.role = role;
    }
    
    const { count, rows } = await User.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']],
      attributes: { exclude: ['password'] }
    });
    
    res.json({
      success: true,
      data: {
        users: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al listar usuarios'
    });
  }
};

// ACTUALIZAR USUARIO
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, email, username, role, estado } = req.body;
    
    const user = await User.findByPk(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    // Validar dominio si se cambia email
    if (email && email !== user.email && !validarDominio(email)) {
      return res.status(400).json({
        success: false,
        message: 'El correo debe pertenecer al dominio @unicesmag.edu.co'
      });
    }
    
    // Verificar duplicados
    if (email !== user.email || username !== user.username) {
      const existente = await User.findOne({
        where: {
          id: { [Op.ne]: id },
          [Op.or]: [{ email }, { username }]
        }
      });
      
      if (existente) {
        return res.status(400).json({
          success: false,
          message: 'El correo o usuario ya está en uso'
        });
      }
    }
    
    await user.update({ nombre, email, username, role, estado });
    
    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: { user }
    });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar usuario'
    });
  }
};

// RESETEAR CONTRASEÑA TEMPORAL (admin)
const resetTemporaryPasswordByAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const tempPassword = generarPasswordTemporal();
    await user.update({
      password: tempPassword,
      must_change_password: true,
      reset_token: null,
      reset_token_expiry: null
    });

    const emailResult = await sendTemporaryPasswordEmail(user, tempPassword);
    if (!emailResult.success) {
      return res.json({
        success: true,
        message: 'Contraseña temporal restablecida, pero el correo falló. Entrega la contraseña manualmente.',
        data: {
          user: { id: user.id, nombre: user.nombre, email: user.email, username: user.username },
          emailEnviado: false,
          passwordTemporal: tempPassword,
          errorEmail: emailResult.error
        }
      });
    }

    res.json({
      success: true,
      message: 'Contraseña temporal restablecida y enviada al correo institucional.',
      data: {
        user: { id: user.id, nombre: user.nombre, email: user.email, username: user.username },
        emailEnviado: true
      }
    });
  } catch (error) {
    console.error('Error al resetear contraseña temporal:', error);
    res.status(500).json({
      success: false,
      message: 'Error al resetear contraseña temporal'
    });
  }
};

// CAMBIAR ESTADO USUARIO (lógico)
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!['activo', 'inactivo'].includes(estado)) {
      return res.status(400).json({
        success: false,
        message: 'Estado inválido. Use activo o inactivo'
      });
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    if (Number(id) === Number(req.user.id) && estado === 'inactivo') {
      return res.status(400).json({
        success: false,
        message: 'No puedes inactivar tu propio usuario'
      });
    }

    if (user.role === 'administrador' && estado === 'inactivo') {
      const adminsActivos = await User.count({
        where: {
          role: 'administrador',
          estado: 'activo',
          id: { [Op.ne]: id }
        }
      });

      if (adminsActivos === 0) {
        return res.status(400).json({
          success: false,
          message: 'No puedes inactivar el último administrador activo'
        });
      }
    }

    await user.update({ estado });

    res.json({
      success: true,
      message: `Usuario ${estado === 'activo' ? 'reactivado' : 'inactivado'} exitosamente`
    });
  } catch (error) {
    console.error('Error al cambiar estado de usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar estado de usuario'
    });
  }
};

// ELIMINAR USUARIO (físico)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findByPk(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    if (Number(id) === Number(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: 'No puedes eliminar tu propio usuario'
      });
    }

    if (user.role === 'administrador') {
      const adminsActivos = await User.count({
        where: {
          role: 'administrador',
          estado: 'activo',
          id: { [Op.ne]: id }
        }
      });

      if (adminsActivos === 0) {
        return res.status(400).json({
          success: false,
          message: 'No puedes eliminar el último administrador activo'
        });
      }
    }

    await User.sequelize.transaction(async (t) => {
      // Liberar referencias de auditoría antes del borrado físico
      await Documento.update({ creado_por: null }, { where: { creado_por: id }, transaction: t });
      await Documento.update({ actualizado_por: null }, { where: { actualizado_por: id }, transaction: t });
      await Documento.update({ eliminado_por: null }, { where: { eliminado_por: id }, transaction: t });

      await user.destroy({ transaction: t });
    });
    
    res.json({
      success: true,
      message: 'Usuario eliminado permanentemente'
    });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar usuario'
    });
  }
};

// CARGA MASIVA DE USUARIOS
const bulkUploadUsers = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se proporcionó archivo Excel'
      });
    }
    
    const workbook = XLSX.readFile(req.file.path);
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    
    const results = {
      total: data.length,
      importados: 0,
      errores: [],
      advertencias: []
    };
    
    const emailsEnArchivo = new Set();
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const fila = i + 2;
      
      try {
        const { nombre, email, username, role } = row;
        const cleanEmail = String(email || '').trim().toLowerCase();
        
        // Validaciones
        if (!nombre || !cleanEmail) {
          results.errores.push({ fila, email, error: 'Campos obligatorios vacíos' });
          continue;
        }
        
        if (!validarDominio(cleanEmail)) {
          results.errores.push({ fila, email, error: 'Dominio no válido. Debe ser @unicesmag.edu.co' });
          continue;
        }
        
        // Duplicado en el mismo archivo
        if (emailsEnArchivo.has(cleanEmail)) {
          results.errores.push({ fila, email: cleanEmail, error: 'Email duplicado en el archivo' });
          continue;
        }
        
        emailsEnArchivo.add(cleanEmail);

        const usernameFinal = await generarUsernameUnico(username, cleanEmail);
        
        // Duplicado en BD
        const existente = await User.findOne({
          where: { [Op.or]: [{ email: cleanEmail }, { username: usernameFinal }] }
        });
        
        if (existente) {
          results.errores.push({ fila, email: cleanEmail, error: 'Usuario ya existe en la base de datos' });
          continue;
        }
        
        // Crear usuario
        const tempPassword = generarPasswordTemporal();
        
        const user = await User.create({
          nombre,
          email: cleanEmail,
          username: usernameFinal,
          password: tempPassword,
          role: role || 'consulta',
          estado: 'activo',
          must_change_password: true
        });
        
        // Enviar email
        const emailResult = await sendWelcomeEmail(user, tempPassword);
        if (!emailResult.success) {
          results.advertencias.push({
            fila,
            email: cleanEmail,
            warning: 'Usuario creado sin envío de correo',
            passwordTemporal: tempPassword
          });
        }
        
        results.importados++;
      } catch (error) {
        results.errores.push({ fila, email: row.email, error: error.message });
      }
    }
    
    // Generar archivo de errores
    if (results.errores.length > 0) {
      const wsErrores = XLSX.utils.json_to_sheet(results.errores);
      const wbErrores = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wbErrores, wsErrores, 'Errores');
      const bufferErrores = XLSX.write(wbErrores, { type: 'buffer', bookType: 'xlsx' });
      
      res.setHeader('Content-Type', 'application/json');
      res.json({
        success: true,
        message: `Importados ${results.importados}/${results.total} usuarios`,
        data: results,
        archivoErrores: bufferErrores.toString('base64')
      });
    } else {
      res.json({
        success: true,
        message: `Todos los usuarios fueron importados exitosamente (${results.importados})`,
        data: results
      });
    }
    
  } catch (error) {
    console.error('Error en carga masiva:', error);
    res.status(500).json({
      success: false,
      message: 'Error en carga masiva de usuarios'
    });
  } finally {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
};

// RECUPERAR CONTRASEÑA
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    const cleanEmail = String(email || '').trim().toLowerCase();
    
    if (!validarEmail(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Debe enviar un correo válido'
      });
    }

    if (!validarDominio(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: 'El correo debe pertenecer al dominio @unicesmag.edu.co'
      });
    }
    
    const user = await User.findOne({ where: { email: cleanEmail, estado: 'activo' } });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'El correo institucional no está registrado en la plataforma'
      });
    }
    
    // Generar token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
    
    await user.update({
      reset_token: hashedToken,
      reset_token_expiry: expiry
    });
    
    // Enviar email
    const emailResult = await sendPasswordResetEmail(user, resetToken);
    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        message: 'No se pudo enviar el correo de recuperación. Verifica la configuración SMTP.',
        error: emailResult.error
      });
    }
    
    res.json({
      success: true,
      message: 'Se ha enviado un enlace de recuperación a tu correo'
    });
  } catch (error) {
    console.error('Error en recuperación de contraseña:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar solicitud'
    });
  }
};

// RESTABLECER CONTRASEÑA
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'El token es obligatorio y la nueva contraseña debe tener al menos 8 caracteres'
      });
    }
    
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    const user = await User.findOne({
      where: {
        reset_token: hashedToken,
        reset_token_expiry: { [Op.gt]: new Date() }
      }
    });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Token inválido o expirado'
      });
    }
    
    // Actualizar contraseña
    await user.update({
      password: newPassword, // Se encripta automáticamente con el hook
      must_change_password: false,
      reset_token: null,
      reset_token_expiry: null
    });
    
    res.json({
      success: true,
      message: 'Contraseña restablecida exitosamente'
    });
  } catch (error) {
    console.error('Error al restablecer contraseña:', error);
    res.status(500).json({
      success: false,
      message: 'Error al restablecer contraseña'
    });
  }
};

module.exports = {
  createUser,
  getUsers,
  updateUser,
  resetTemporaryPasswordByAdmin,
  updateUserStatus,
  deleteUser,
  bulkUploadUsers,
  requestPasswordReset,
  resetPassword
};
