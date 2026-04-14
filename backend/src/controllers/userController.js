const models = require('../models');
const { User, UserModulePermission } = models;
const { DataTypes, Op, literal } = require('sequelize');
const crypto = require('crypto');
const XLSX = require('xlsx');
const fs = require('fs');
const { ROLES } = require('../constants/roles');
const { sendWelcomeEmail, sendPasswordResetEmail } = require('../services/emailService');
const MAX_BULK_USER_IMPORT_ROWS = Number(process.env.MAX_BULK_USER_IMPORT_ROWS || 2000);

const VALID_ROLES = Object.values(ROLES);
const MENU_PERMISSION_KEYS = [
  'dashboard',
  'planeacion_estrategica',
  'aseguramiento_calidad',
  'gestion_informacion',
  'planeacion_efectividad',
  'autoevaluacion',
  'gestion_usuarios',
  'gestion_documentos',
  'buscar_documentos'
];
const GESTION_INFO_MODULE_KEYS = [
  'gestion_bases_datos',
  'estadistica_institucional'
];
const GESTION_PROCESOS_DASHBOARD_PERMISSION_KEYS = [
  'estadistica_documental'
];
const POBLACIONAL_DASHBOARD_PERMISSION_KEYS = [
  'poblacional_flujo',
  'poblacional_matriculados',
  'poblacional_graduados',
  'poblacional_caracterizacion',
  'poblacional_resumen_estadistico',
  'poblacional_desercion',
  'poblacional_empleabilidad',
  'poblacional_saber_pro'
];
const SABER_PRO_DASHBOARD_PERMISSION_KEYS = [
  'saber_pro_consulta_individual',
  'saber_pro_validacion_masiva',
  'saber_pro_individuales_general',
  'saber_pro_individuales_saber_pro',
  'saber_pro_individuales_tyt',
  'saber_pro_individuales_destacados',
  'saber_pro_individuales_competencias',
  'saber_pro_individuales_becas',
  'saber_pro_agregados_general',
  'saber_pro_agregados_competencias_especificas',
  'saber_pro_agregados_competencias_genericas',
  'saber_pro_agregados_comparativo_general',
  'saber_pro_agregados_comparativo_especificas',
  'saber_pro_valor_agregado_individual',
  'saber_pro_valor_agregado_resultado_general',
  'saber_pro_valor_agregado_estadistica_general',
  'saber_pro_valor_agregado_nbc'
];
const ALL_MODULE_PERMISSION_KEYS = [
  ...MENU_PERMISSION_KEYS,
  ...GESTION_INFO_MODULE_KEYS,
  ...GESTION_PROCESOS_DASHBOARD_PERMISSION_KEYS,
  ...POBLACIONAL_DASHBOARD_PERMISSION_KEYS,
  ...SABER_PRO_DASHBOARD_PERMISSION_KEYS
];
const MANAGED_PLANEACION_ROLES = [
  ROLES.PLANEACION_ESTRATEGICA,
  ROLES.PLANEACION_EFECTIVIDAD,
  ROLES.AUTOEVALUACION,
  ROLES.GESTION_INFORMACION
];
const MANAGED_GESTION_PROCESOS_ROLES = [ROLES.CONSULTA];
const ROLE_LABELS = {
  [ROLES.ADMINISTRADOR]: 'Administrador General',
  [ROLES.CONSULTA]: 'Consulta',
  [ROLES.GESTION_PROCESOS]: 'Gestion por Procesos',
  [ROLES.PLANEACION_ESTRATEGICA]: 'Planeacion Estrategica',
  [ROLES.PLANEACION_EFECTIVIDAD]: 'Planeacion y Efectividad',
  [ROLES.AUTOEVALUACION]: 'Autoevaluacion',
  [ROLES.GESTION_INFORMACION]: 'Gestion de la Informacion'
};

const isSuperAdmin = (user) => user?.role === ROLES.ADMINISTRADOR;
const isPlaneacionManager = (user) => user?.role === ROLES.PLANEACION_ESTRATEGICA;
const isGestionProcesosManager = (user) => user?.role === ROLES.GESTION_PROCESOS;
const canManageRole = (operator, targetRole) =>
  isSuperAdmin(operator) ||
  (isPlaneacionManager(operator) && MANAGED_PLANEACION_ROLES.includes(targetRole)) ||
  (isGestionProcesosManager(operator) && MANAGED_GESTION_PROCESOS_ROLES.includes(targetRole));
const getManageableRoles = (operator) => {
  if (isSuperAdmin(operator)) return VALID_ROLES;
  if (isPlaneacionManager(operator)) return MANAGED_PLANEACION_ROLES;
  if (isGestionProcesosManager(operator)) return MANAGED_GESTION_PROCESOS_ROLES;
  return [];
};
const normalizeRoleInput = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  const byCode = VALID_ROLES.find((role) => role === normalized);
  if (byCode) return byCode;

  const byLabel = Object.entries(ROLE_LABELS).find(([, label]) => {
    const cleanLabel = String(label || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
    return cleanLabel === normalized;
  });
  return byLabel ? byLabel[0] : '';
};

const getInstitutionalDomain = () => (process.env.INSTITUTIONAL_EMAIL_DOMAIN || 'unicesmag.edu.co').trim().toLowerCase();

// Validar dominio institucional
const validarDominio = (email) => {
  const domain = getInstitutionalDomain();
  const regex = new RegExp(`^[a-zA-Z0-9._%+-]+@${domain.replace('.', '\\.')}$`);
  return regex.test(String(email || '').trim().toLowerCase());
};

const validarEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

// Generar contraseña temporal
const generarPasswordInterna = () => {
  return crypto.randomBytes(24).toString('hex');
};

const buildProvisioningWarning = (emailResult) =>
  `El usuario se creó correctamente, pero no se pudo enviar el correo institucional (${emailResult?.error || 'error SMTP no especificado'}).`;

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

const normalizeHeader = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');

const USER_HEADER_ALIASES = {
  numero_documento: 'username',
  documento: 'username',
  documento_numero: 'username',
  numero: 'username',
  nombre_completo: 'nombre',
  nombres_completos: 'nombre',
  nombres: 'nombre',
  nombre: 'nombre',
  correo_institucional: 'email',
  correo: 'email',
  email: 'email',
  rol: 'role',
  role: 'role'
};

const mapRowKeys = (row = {}) => {
  const mapped = {};
  Object.entries(row).forEach(([key, value]) => {
    const normalized = normalizeHeader(key);
    const target = USER_HEADER_ALIASES[normalized] || normalized;
    mapped[target] = value;
  });
  return mapped;
};

const normalizarDocumento = (value) => String(value || '').trim();

const esDocumentoValido = (value) => /^[0-9]{4,15}$/.test(String(value || '').trim());

const normalizePagination = ({ page = 1, limit = 10 } = {}) => {
  const cleanPage = Math.max(Number.parseInt(page, 10) || 1, 1);
  const cleanLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 10, 1), 100);
  return {
    page: cleanPage,
    limit: cleanLimit,
    offset: (cleanPage - 1) * cleanLimit
  };
};

const sanitizeUserPayload = ({ nombre, email, username, role, estado } = {}) => ({
  nombre: String(nombre || '').trim().replace(/\s+/g, ' '),
  email: String(email || '').trim().toLowerCase(),
  username: normalizarDocumento(username),
  role,
  estado
});

const USER_REFERENCE_FIELDS = ['creado_por', 'actualizado_por', 'eliminado_por', 'resuelto_por', 'user_id'];
const USER_DEPENDENCY_DESTROY_MODELS = new Set(['documento_favoritos', 'user_module_permissions']);
const USER_DELETE_STATEMENT_TIMEOUT_MS = Math.max(
  Number(process.env.USER_DELETE_STATEMENT_TIMEOUT_MS || 120000),
  500
);
let userModulePermissionsReadyPromise = null;
let userReferenceIndexesReadyPromise = null;
const modelTableAvailability = new Map();

const ensureUserModulePermissionsReady = async () => {
  if (userModulePermissionsReadyPromise) return userModulePermissionsReadyPromise;

  userModulePermissionsReadyPromise = (async () => {
    await UserModulePermission.sync();

    const queryInterface = User.sequelize.getQueryInterface();
    const tableName = UserModulePermission.getTableName();
    const described = await queryInterface.describeTable(tableName).catch(() => null);
    if (!described) return;

    const addColumnIfMissing = async (column, definition) => {
      if (described[column]) return;
      await queryInterface.addColumn(tableName, column, definition);
    };

    await addColumnIfMissing('can_view', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });
    await addColumnIfMissing('can_manage', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    await addColumnIfMissing('created_at', {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: literal('CURRENT_TIMESTAMP')
    });
    await addColumnIfMissing('updated_at', {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: literal('CURRENT_TIMESTAMP')
    });

    await queryInterface.addIndex(tableName, ['user_id', 'module_key'], {
      unique: true,
      name: 'user_module_permissions_user_id_module_key'
    }).catch(() => {});
  })().catch((error) => {
    userModulePermissionsReadyPromise = null;
    throw error;
  });

  return userModulePermissionsReadyPromise;
};

const hasModelTable = async (model) => {
  const tableName = model.getTableName ? model.getTableName() : model.tableName;
  const key = typeof tableName === 'string' ? tableName : JSON.stringify(tableName);
  if (modelTableAvailability.has(key)) return modelTableAvailability.get(key);

  const queryInterface = User.sequelize.getQueryInterface();
  const exists = Boolean(await queryInterface.describeTable(tableName).catch(() => null));
  modelTableAvailability.set(key, exists);
  return exists;
};

const getModelTableColumns = async (model) => {
  const tableName = model.getTableName ? model.getTableName() : model.tableName;
  const key = `columns:${typeof tableName === 'string' ? tableName : JSON.stringify(tableName)}`;
  if (modelTableAvailability.has(key)) return modelTableAvailability.get(key);

  const queryInterface = User.sequelize.getQueryInterface();
  const described = await queryInterface.describeTable(tableName).catch(() => null);
  const columns = new Set(Object.keys(described || {}));
  modelTableAvailability.set(key, columns);
  return columns;
};

const getUserForeignKeyReferences = async (transaction) => {
  const [references] = await User.sequelize.query(`
    SELECT
      tc.table_schema AS schema_name,
      tc.table_name,
      kcu.column_name,
      c.is_nullable,
      rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name
      AND rc.constraint_schema = tc.table_schema
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.columns c
      ON c.table_schema = tc.table_schema
      AND c.table_name = tc.table_name
      AND c.column_name = kcu.column_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_schema = 'public'
      AND ccu.table_name = 'users'
      AND ccu.column_name = 'id'
  `, { transaction });

  return (references || []).filter((reference) => {
    const tableName = String(reference.table_name || '');
    const columnName = String(reference.column_name || '');
    return tableName && columnName && tableName !== 'users';
  });
};

const ensureUserReferenceIndexes = async () => {
  if (userReferenceIndexesReadyPromise) return userReferenceIndexesReadyPromise;

  userReferenceIndexesReadyPromise = (async () => {
    const queryInterface = User.sequelize.getQueryInterface();
    const quote = (identifier) => queryInterface.quoteIdentifier(identifier);
    const references = await getUserForeignKeyReferences();

    for (const reference of references) {
      const schemaName = String(reference.schema_name || 'public');
      const tableName = String(reference.table_name || '');
      const columnName = String(reference.column_name || '');
      const indexName = `idx_users_fk_${tableName}_${columnName}`
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .slice(0, 60);

      await User.sequelize.query(
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${quote(indexName)} ON ${quote(schemaName)}.${quote(tableName)} (${quote(columnName)})`
      ).catch((error) => {
        console.warn(`No se pudo crear/verificar indice ${indexName}:`, error?.message || error);
      });
    }
  })().catch((error) => {
    userReferenceIndexesReadyPromise = null;
    throw error;
  });

  return userReferenceIndexesReadyPromise;
};

const detachUserReferences = async (userId, transaction) => {
  const skipped = new Set(['users']);

  for (const model of Object.values(models)) {
    const tableName = String(model.tableName || model.name || '');
    if (!model?.rawAttributes || !model?.getTableName || skipped.has(tableName)) continue;
    if (!await hasModelTable(model)) continue;

    const tableColumns = await getModelTableColumns(model);
    const referenceFields = USER_REFERENCE_FIELDS.filter((field) =>
      model.rawAttributes[field] && tableColumns.has(field)
    );
    if (referenceFields.length === 0) continue;

    const shouldDestroy = USER_DEPENDENCY_DESTROY_MODELS.has(tableName) || USER_DEPENDENCY_DESTROY_MODELS.has(model.name);

    for (const field of referenceFields) {
      try {
        if (shouldDestroy && field === 'user_id') {
          await model.destroy({ where: { [field]: userId }, transaction });
          continue;
        }

        if (model.rawAttributes[field]?.allowNull === false) continue;

        await model.update({ [field]: null }, { where: { [field]: userId }, transaction });
      } catch (error) {
        const message = String(error?.message || '');
        if (/does not exist|relation .* does not exist|no existe/i.test(message)) {
          console.warn(`Tabla no disponible al limpiar referencias de usuario (${tableName}.${field}):`, message);
          continue;
        }
        throw error;
      }
    }
  }
};

const detachUserForeignKeyReferences = async (userId, transaction) => {
  const queryInterface = User.sequelize.getQueryInterface();
  const quote = (identifier) => queryInterface.quoteIdentifier(identifier);

  const references = await getUserForeignKeyReferences(transaction);

  for (const reference of references || []) {
    const schemaName = String(reference.schema_name || 'public');
    const tableName = String(reference.table_name || '');
    const columnName = String(reference.column_name || '');
    if (!tableName || !columnName || tableName === 'users') continue;

    const qualifiedTable = `${quote(schemaName)}.${quote(tableName)}`;
    const quotedColumn = quote(columnName);
    const shouldDestroy = USER_DEPENDENCY_DESTROY_MODELS.has(tableName);
    const deleteRule = String(reference.delete_rule || '').toUpperCase();

    if (deleteRule === 'CASCADE' || deleteRule === 'SET NULL') continue;

    if (shouldDestroy) {
      await User.sequelize.query(
        `DELETE FROM ${qualifiedTable} WHERE ${quotedColumn} = :userId`,
        { replacements: { userId }, transaction }
      );
      continue;
    }

    if (String(reference.is_nullable || '').toUpperCase() !== 'YES') {
      throw new Error(`No se puede separar la referencia obligatoria ${tableName}.${columnName}`);
    }

    await User.sequelize.query(
      `UPDATE ${qualifiedTable} SET ${quotedColumn} = NULL WHERE ${quotedColumn} = :userId`,
      { replacements: { userId }, transaction }
    );
  }
};

const cleanupDirectUserDependencies = async (userId, transaction) => {
  const directDependencyModels = [UserModulePermission, models.DocumentoFavorito].filter(Boolean);

  for (const model of directDependencyModels) {
    if (!await hasModelTable(model)) continue;
    const columns = await getModelTableColumns(model);
    if (!columns.has('user_id')) continue;
    await model.destroy({ where: { user_id: userId }, transaction });
  }
};

const performPhysicalUserDelete = async (userId) => {
  await ensureUserReferenceIndexes();

  await User.sequelize.transaction(async (t) => {
    await User.sequelize.query(
      `SET LOCAL statement_timeout = '${USER_DELETE_STATEMENT_TIMEOUT_MS}ms'`,
      { transaction: t }
    );
    await cleanupDirectUserDependencies(userId, t);
    await detachUserForeignKeyReferences(userId, t);
    await User.destroy({ where: { id: userId }, transaction: t });
  });
};

// CREAR USUARIO INDIVIDUAL
const createUser = async (req, res) => {
  try {
    const { nombre, email, username, role } = sanitizeUserPayload(req.body);
    const numeroDocumento = username;
    const cleanEmail = email;
    
    // Validar dominio
    if (!validarDominio(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: 'El correo debe pertenecer al dominio @unicesmag.edu.co'
      });
    }

    if (!nombre || !cleanEmail || !numeroDocumento) {
      return res.status(400).json({
        success: false,
        message: 'Número de documento, nombre y correo son obligatorios'
      });
    }

    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Rol inválido'
      });
    }

    const targetRole = role || ROLES.CONSULTA;
    if (!canManageRole(req.user, targetRole)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para crear usuarios con este rol'
      });
    }

    if (!esDocumentoValido(numeroDocumento)) {
      return res.status(400).json({
        success: false,
        message: 'El número de documento debe contener solo números (4 a 15 dígitos).'
      });
    }

    const usernameFinal = await generarUsernameUnico(numeroDocumento, cleanEmail);
    
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
    const internalPassword = generarPasswordInterna();
    
    // Crear usuario
    const user = await User.create({
      nombre,
      email: cleanEmail,
      username: usernameFinal,
      password: internalPassword,
      role: targetRole,
      estado: 'activo',
      must_change_password: false
    });

    const emailResult = await sendWelcomeEmail(user);
    const message = emailResult.success
      ? 'Usuario creado exitosamente. Se notificó por correo institucional.'
      : buildProvisioningWarning(emailResult);

    res.status(201).json({
      success: true,
      message,
      data: {
        user,
        notification: {
          emailSent: Boolean(emailResult.success),
          error: emailResult.success ? null : emailResult.error
        }
      }
    });
  } catch (error) {
    console.error('Error al crear usuario:', error);

    if (error?.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        success: false,
        message: 'El correo o nombre de usuario ya existe'
      });
    }

    if (error?.name === 'SequelizeDatabaseError' && String(error?.message || '').includes('enum_users_role')) {
      return res.status(400).json({
        success: false,
        message: 'El rol no está disponible en la base de datos. Ejecuta la migración de roles.'
      });
    }

    res.status(500).json({
      success: false,
      message: error?.message || 'Error al crear usuario'
    });
  }
};

// LISTAR USUARIOS
const getUsers = async (req, res) => {
  try {
    const { search = '', role = '' } = req.query;
    const pagination = normalizePagination(req.query);
    
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

    if (isPlaneacionManager(req.user)) {
      if (role && !MANAGED_PLANEACION_ROLES.includes(role)) {
        return res.json({
          success: true,
          data: {
            users: [],
            pagination: { total: 0, page: pagination.page, limit: pagination.limit, totalPages: 0 }
          }
        });
      }

      if (!role) {
        where.role = { [Op.in]: MANAGED_PLANEACION_ROLES };
      }
    }

    if (isGestionProcesosManager(req.user)) {
      if (role && !MANAGED_GESTION_PROCESOS_ROLES.includes(role)) {
        return res.json({
          success: true,
          data: {
            users: [],
            pagination: { total: 0, page: pagination.page, limit: pagination.limit, totalPages: 0 }
          }
        });
      }

      if (!role) {
        where.role = { [Op.in]: MANAGED_GESTION_PROCESOS_ROLES };
      }
    }
    
    const { count, rows } = await User.findAndCountAll({
      where,
      limit: pagination.limit,
      offset: pagination.offset,
      order: [
        [literal('CAST("role" AS TEXT)'), 'ASC'],
        ['nombre', 'ASC'],
        ['created_at', 'DESC']
      ],
      attributes: { exclude: ['password'] }
    });
    
    res.json({
      success: true,
      data: {
        users: rows,
        pagination: {
          total: count,
          page: pagination.page,
          limit: pagination.limit,
          totalPages: Math.ceil(count / pagination.limit)
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
    const { nombre, email, username, role, estado } = sanitizeUserPayload(req.body);
    
    const user = await User.findByPk(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    if (!canManageRole(req.user, user.role)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para este usuario'
      });
    }

    const targetRole = role || user.role;
    if (!canManageRole(req.user, targetRole)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para asignar ese rol'
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
    if ((email && email !== user.email) || (username && username !== user.username)) {
      const existente = await User.findOne({
        where: {
          id: { [Op.ne]: id },
          [Op.or]: [
            ...(email ? [{ email }] : []),
            ...(username ? [{ username }] : [])
          ]
        }
      });
      
      if (existente) {
        return res.status(400).json({
          success: false,
          message: 'El correo o usuario ya está en uso'
        });
      }
    }
    
    if (username && !esDocumentoValido(username)) {
      return res.status(400).json({
        success: false,
        message: 'El número de documento debe contener solo números (4 a 15 dígitos).'
      });
    }

    await user.update({
      nombre: nombre || user.nombre,
      email: email || user.email,
      username: username || user.username,
      role: targetRole,
      estado: estado || user.estado
    });
    
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

    if (!canManageRole(req.user, user.role)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para este usuario'
      });
    }

    if (Number(id) === Number(req.user.id) && estado === 'inactivo') {
      return res.status(400).json({
        success: false,
        message: 'No puedes inactivar tu propio usuario'
      });
    }

    if (user.role === ROLES.ADMINISTRADOR && estado === 'inactivo') {
      const adminsActivos = await User.count({
        where: {
          role: ROLES.ADMINISTRADOR,
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

    let notification = {
      emailSent: false,
      error: null
    };

    let message = `Usuario ${estado === 'activo' ? 'reactivado' : 'inactivado'} exitosamente`;

    if (estado === 'activo') {
      const emailResult = await sendWelcomeEmail(user);
      notification = {
        emailSent: Boolean(emailResult.success),
        error: emailResult.success ? null : emailResult.error
      };

      if (!emailResult.success) {
        message = `${message}. No se pudo enviar el correo institucional (${emailResult.error || 'error SMTP no especificado'}).`;
      }
    }

    res.json({
      success: true,
      message,
      data: {
        id: user.id,
        estado,
        notification
      }
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

    if (!canManageRole(req.user, user.role)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para eliminar este usuario'
      });
    }

    if (Number(id) === Number(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: 'No puedes eliminar tu propio usuario'
      });
    }

    if (user.role === ROLES.ADMINISTRADOR) {
      const adminsActivos = await User.count({
        where: {
          role: ROLES.ADMINISTRADOR,
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

    await performPhysicalUserDelete(id);
    
    res.json({
      success: true,
      message: 'Usuario eliminado',
      data: {
        id: user.id,
        deletedPhysically: true,
        deletePending: false,
        estado: null
      }
    });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    const errorMessage = /statement timeout|canceling statement due to statement timeout/i.test(String(error?.message || ''))
      ? 'No se pudo eliminar definitivamente por tiempo de espera en la base de datos. Intenta nuevamente cuando termine la preparación de índices.'
      : 'Error al eliminar usuario';

    res.status(500).json({
      success: false,
      message: errorMessage
    });
  }
};

const downloadUsersTemplate = async (req, res) => {
  try {
    const allowedRoles = getManageableRoles(req.user);
    const headers = [
      'NUMERO_DOCUMENTO',
      'NOMBRE_COMPLETO',
      'CORREO_INSTITUCIONAL',
      'ROL'
    ];

    const worksheet = XLSX.utils.json_to_sheet([], { header: headers });
    worksheet['!cols'] = [
      { wch: 20 },
      { wch: 35 },
      { wch: 35 },
      { wch: 25 }
    ];
    const maxRows = Math.max(1000, MAX_BULK_USER_IMPORT_ROWS + 1);
    const listFormula = `"${allowedRoles.join(',')}"`;
    worksheet['!dataValidation'] = [
      {
        type: 'list',
        allowBlank: false,
        sqref: `D2:D${maxRows}`,
        formula1: listFormula
      }
    ];

    const catalogRows = allowedRoles.map((role) => ({
      ROL: role,
      DESCRIPCION: ROLE_LABELS[role] || role
    }));
    const catalogSheet = XLSX.utils.json_to_sheet(catalogRows, { header: ['ROL', 'DESCRIPCION'] });
    catalogSheet['!cols'] = [
      { wch: 30 },
      { wch: 35 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Usuarios');
    XLSX.utils.book_append_sheet(workbook, catalogSheet, 'RolesPermitidos');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename=plantilla_usuarios_sgc.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al generar plantilla de usuarios' });
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

    if (data.length > MAX_BULK_USER_IMPORT_ROWS) {
      return res.status(400).json({
        success: false,
        message: `El archivo supera el límite permitido (${MAX_BULK_USER_IMPORT_ROWS} filas)`
      });
    }
    
    const allowedRoles = getManageableRoles(req.user);
    const results = {
      total: data.length,
      importados: 0,
      errores: [],
      advertencias: []
    };
    
    const emailsEnArchivo = new Set();
    
    const unauthorizedRows = [];
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const fila = i + 2;
      const rowNormalized = mapRowKeys(row);
      const roleInput = rowNormalized.role;
      const role = normalizeRoleInput(roleInput);
      const targetRole = role || ROLES.CONSULTA;

      if (String(roleInput || '').trim() && !role) {
        continue;
      }

      if (!canManageRole(req.user, targetRole)) {
        unauthorizedRows.push({
          fila,
          role: String(roleInput || '').trim() || targetRole,
          permitido: allowedRoles.join(', ')
        });
      }
    }

    if (unauthorizedRows.length > 0) {
      return res.status(403).json({
        success: false,
        message: 'El archivo contiene roles no permitidos para tu perfil. No se realizó la carga masiva.',
        data: {
          unauthorizedRows,
          allowedRoles
        }
      });
    }

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const fila = i + 2;
      
      try {
        const rowNormalized = mapRowKeys(row);
        const nombre = rowNormalized.nombre;
        const email = rowNormalized.email;
        const username = rowNormalized.username;
        const roleInput = rowNormalized.role;
        const role = normalizeRoleInput(roleInput);
        const cleanEmail = String(email || '').trim().toLowerCase();
        
        // Validaciones
        if (!nombre || !cleanEmail || !username) {
          results.errores.push({ fila, email, error: 'Campos obligatorios vacíos' });
          continue;
        }
        
        if (!validarDominio(cleanEmail)) {
          results.errores.push({ fila, email, error: 'Dominio no válido. Debe ser @unicesmag.edu.co' });
          continue;
        }

        if (!esDocumentoValido(username)) {
          results.errores.push({ fila, email: cleanEmail, error: 'Número de documento inválido' });
          continue;
        }

        if (roleInput && !role) {
          results.errores.push({ fila, email: cleanEmail, error: 'Rol inválido en archivo' });
          continue;
        }

        const targetRole = role || ROLES.CONSULTA;
        if (!canManageRole(req.user, targetRole)) {
          results.errores.push({ fila, email: cleanEmail, error: 'Sin permisos para crear este rol' });
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
        const internalPassword = generarPasswordInterna();
        
        const user = await User.create({
          nombre,
          email: cleanEmail,
          username: usernameFinal,
          password: internalPassword,
          role: targetRole,
          estado: 'activo',
          must_change_password: false
        });

        const emailResult = await sendWelcomeEmail(user);
        if (!emailResult.success) {
          results.advertencias.push({
            fila,
            email: cleanEmail,
            warning: `No se pudo enviar correo institucional: ${emailResult.error}`
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

const getUserModulePermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id, { attributes: ['id', 'nombre', 'email', 'role'] });

    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    if (!canManageRole(req.user, user.role)) {
      return res.status(403).json({ success: false, message: 'No tienes permisos para este usuario' });
    }

    await ensureUserModulePermissionsReady();

    const rows = await UserModulePermission.findAll({
      where: { user_id: id },
      attributes: ['module_key', 'can_view', 'can_manage'],
      order: [['module_key', 'ASC']]
    });

    const map = rows.reduce((acc, row) => {
      acc[row.module_key] = {
        can_view: Boolean(row.can_view),
        can_manage: Boolean(row.can_manage)
      };
      return acc;
    }, {});

    return res.json({
      success: true,
      data: {
        user,
        catalogs: {
          menu: MENU_PERMISSION_KEYS,
          gestionInformacion: GESTION_INFO_MODULE_KEYS,
          gestionProcesosDashboards: GESTION_PROCESOS_DASHBOARD_PERMISSION_KEYS,
          poblacionalDashboards: POBLACIONAL_DASHBOARD_PERMISSION_KEYS,
          saberProDashboards: SABER_PRO_DASHBOARD_PERMISSION_KEYS
        },
        permissions: map
      }
    });
  } catch (error) {
    console.error('Error al obtener permisos de módulo:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener permisos de módulo' });
  }
};

const updateUserModulePermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      menuPermissions = [],
      allowedModules = [],
      allowedGestionProcesosDashboards = [],
      allowedPoblacionalDashboards = [],
      allowedSaberProDashboards = []
    } = req.body || {};

    const user = await User.findByPk(id, { attributes: ['id', 'nombre', 'email', 'role'] });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    if (!canManageRole(req.user, user.role)) {
      return res.status(403).json({ success: false, message: 'No tienes permisos para este usuario' });
    }

    await ensureUserModulePermissionsReady();

    const cleanMenu = Array.from(new Set((Array.isArray(menuPermissions) ? menuPermissions : [])
      .map((x) => String(x || '').trim())
      .filter((x) => MENU_PERMISSION_KEYS.includes(x))));

    const cleanModules = Array.from(new Set((Array.isArray(allowedModules) ? allowedModules : [])
      .map((x) => String(x || '').trim())
      .filter((x) => GESTION_INFO_MODULE_KEYS.includes(x))));

    const cleanGestionProcesosDashboards = Array.from(new Set((Array.isArray(allowedGestionProcesosDashboards) ? allowedGestionProcesosDashboards : [])
      .map((x) => String(x || '').trim())
      .filter((x) => GESTION_PROCESOS_DASHBOARD_PERMISSION_KEYS.includes(x))));

    const cleanPoblacionalDashboards = Array.from(new Set((Array.isArray(allowedPoblacionalDashboards) ? allowedPoblacionalDashboards : [])
      .map((x) => String(x || '').trim())
      .filter((x) => POBLACIONAL_DASHBOARD_PERMISSION_KEYS.includes(x))));

    const cleanSaberProDashboards = Array.from(new Set((Array.isArray(allowedSaberProDashboards) ? allowedSaberProDashboards : [])
      .map((x) => String(x || '').trim())
      .filter((x) => SABER_PRO_DASHBOARD_PERMISSION_KEYS.includes(x))));

    if (cleanGestionProcesosDashboards.length > 0 && !cleanModules.includes('estadistica_institucional')) {
      cleanModules.push('estadistica_institucional');
    }
    if (cleanPoblacionalDashboards.length > 0 && !cleanModules.includes('estadistica_institucional')) {
      cleanModules.push('estadistica_institucional');
    }
    if (cleanSaberProDashboards.length > 0 && !cleanModules.includes('estadistica_institucional')) {
      cleanModules.push('estadistica_institucional');
    }
    if ((cleanModules.length > 0 || cleanGestionProcesosDashboards.length > 0 || cleanPoblacionalDashboards.length > 0 || cleanSaberProDashboards.length > 0) && !cleanMenu.includes('gestion_informacion')) {
      cleanMenu.push('gestion_informacion');
    }

    const allSelected = [...cleanMenu, ...cleanModules, ...cleanGestionProcesosDashboards, ...cleanPoblacionalDashboards, ...cleanSaberProDashboards];

    await User.sequelize.transaction(async (t) => {
      await UserModulePermission.destroy({ where: { user_id: id }, transaction: t });
      if (allSelected.length > 0) {
        await UserModulePermission.bulkCreate(
          allSelected.map((module_key) => ({
            user_id: Number(id),
            module_key,
            can_view: true,
            can_manage: false
          })),
          { transaction: t }
        );
      }
    });

    return res.json({
      success: true,
      message: 'Permisos de módulos actualizados',
      data: {
        user,
        menuPermissions: cleanMenu,
        allowedModules: cleanModules,
        allowedGestionProcesosDashboards: cleanGestionProcesosDashboards,
        allowedPoblacionalDashboards: cleanPoblacionalDashboards,
        allowedSaberProDashboards: cleanSaberProDashboards
      }
    });
  } catch (error) {
    console.error('Error al actualizar permisos de módulo:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar permisos de módulo' });
  }
};

module.exports = {
  createUser,
  getUsers,
  updateUser,
  updateUserStatus,
  deleteUser,
  bulkUploadUsers,
  downloadUsersTemplate,
  getUserModulePermissions,
  updateUserModulePermissions
};
