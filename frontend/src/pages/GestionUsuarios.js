import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, IconButton, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Select, MenuItem, FormControl, InputLabel,
  Chip, Grid, Alert, CircularProgress, Fade, FormGroup, FormControlLabel, Checkbox, Divider,
  Stack, Radio, RadioGroup, Autocomplete, Menu, InputAdornment
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Upload as UploadIcon,
  Download as DownloadIcon, Search as SearchIcon, Clear as ClearIcon,
  Block as BlockIcon, CheckCircle as CheckCircleIcon,
  GroupOutlined as GroupIcon, Security as SecurityIcon, ArrowForward as ArrowForwardIcon,
  Warning as WarningIcon, FilterList as FilterListIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import * as XLSX from 'xlsx';
import userService from '../services/userService';
import { ROLES, ROLE_LABELS } from '../constants/roles';
import { useAuth } from '../context/AuthContext';


const DependenciaFilterPanel = ({ label, options, value, onChange, placeholder }) => {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const [search, setSearch] = React.useState('');
  const open = Boolean(anchorEl);

  const handleClick = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => {
    setAnchorEl(null);
    setSearch('');
  };

  const handleToggle = (option) => {
    const isSelected = value.includes(option);
    if (isSelected) {
      onChange(value.filter((item) => item !== option));
    } else {
      onChange([...value, option]);
    }
  };

  const filteredOptions = options.filter(opt => 
    opt.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Button
        variant={value.length > 0 ? "contained" : "outlined"}
        onClick={handleClick}
        endIcon={<FilterListIcon />}
        sx={{ 
          borderRadius: 1.5,
          textTransform: 'none',
          fontWeight: 500,
          fontSize: 13,
          color: value.length > 0 ? '#fff' : '#475569',
          borderColor: value.length > 0 ? 'transparent' : '#cbd5e1',
          bgcolor: value.length > 0 ? '#2563eb' : 'transparent',
          '&:hover': {
            bgcolor: value.length > 0 ? '#1d4ed8' : '#f8fafc',
            borderColor: value.length > 0 ? 'transparent' : '#94a3b8'
          },
          minWidth: 350,
          justifyContent: 'space-between',
          px: 2,
          py: 0.8
        }}
      >
        {value.length === 0 ? label : `${label} (${value.length})`}
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          elevation: 0,
          sx: {
            mt: 1,
            width: 320,
            borderRadius: 2,
            border: '1px solid #e2e8f0',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            maxHeight: 400
          }
        }}
        transformOrigin={{ horizontal: 'left', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
      >
        <Box sx={{ p: 1.5, borderBottom: '1px solid #e2e8f0' }}>
          <TextField
            size="small"
            fullWidth
            placeholder={placeholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: '#94a3b8' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 1.5,
                bgcolor: '#f8fafc',
                '& fieldset': { borderColor: 'transparent' },
                '&:hover fieldset': { borderColor: '#cbd5e1' },
                '&.Mui-focused fieldset': { borderColor: '#2563eb' }
              }
            }}
          />
        </Box>
        <Box sx={{ p: 1, maxHeight: 260, overflowY: 'auto' }}>
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <MenuItem 
                key={option} 
                onClick={() => handleToggle(option)}
                sx={{ 
                  borderRadius: 1,
                  mb: 0.5,
                  '&:hover': { bgcolor: '#f1f5f9' }
                }}
              >
                <Checkbox 
                  checked={value.includes(option)}
                  size="small"
                  sx={{ 
                    color: '#cbd5e1',
                    '&.Mui-checked': { color: '#2563eb' },
                    p: 0.5,
                    mr: 1
                  }}
                />
                <Typography variant="body2" sx={{ color: '#334155', fontWeight: 500, fontSize: 12.5 }}>
                  {option}
                </Typography>
              </MenuItem>
            ))
          ) : (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No se encontraron opciones
              </Typography>
            </Box>
          )}
        </Box>
        {value.length > 0 && (
          <Box sx={{ p: 1, borderTop: '1px solid #e2e8f0' }}>
            <Button
              fullWidth
              size="small"
              onClick={() => onChange([])}
              sx={{ 
                color: '#64748b', 
                textTransform: 'none',
                '&:hover': { bgcolor: '#f1f5f9', color: '#0f172a' }
              }}
            >
              Limpiar filtros
            </Button>
          </Box>
        )}
      </Menu>
    </>
  );
};

function GestionUsuarios() {
  const MENU_PERMISSION_OPTIONS = [
    { key: 'dashboard', label: 'Inicio' },
    { key: 'gestion_informacion', label: 'Gestión de la Información' },
    { key: 'buscar_documentos', label: 'Consulta de documentos' },
    { key: 'planeacion_estrategica', label: 'Planeación Estratégica' },
    { key: 'planeacion_efectividad', label: 'Planeación y Efectividad' },
    { key: 'autoevaluacion', label: 'Autoevaluación' },
    { key: 'registros_calificados', label: 'Registros Calificados y Acreditación' },
    { key: 'aseguramiento_calidad', label: 'Administración del Sistema Documental' },
    { key: 'gestion_usuarios', label: 'Gestión de Usuarios' }
  ];
  const GI_MODULE_OPTIONS = [
    { key: 'gestion_bases_datos', label: 'Gestion de Bases de Datos', group: 'Acceso general' },
    { key: 'estadistica_institucional', label: 'Estadistica Institucional', group: 'Acceso general' },
    { key: 'poblacional', label: 'Poblacional', group: 'Tableros estadisticos' },
    { key: 'georreferencia', label: 'Georreferencia', group: 'Tableros estadisticos' },
    { key: 'biblioteca', label: 'Biblioteca', group: 'Tableros estadisticos' },
    { key: 'medios_educativos', label: 'Medios Educativos', group: 'Tableros estadisticos' },
    { key: 'internacionalizacion', label: 'Internacionalizacion', group: 'Tableros estadisticos' },
    { key: 'investigacion', label: 'Investigacion', group: 'Tableros estadisticos' },
    { key: 'proyectos_convenios', label: 'Proyectos y Convenios', group: 'Tableros estadisticos' },
    { key: 'recurso_humano', label: 'Gestión del Talento Humano', group: 'Tableros estadisticos' },
    { key: 'infraestructura_fisica', label: 'Infraestructura Física', group: 'Tableros estadisticos' },
    { key: 'saber_pro', label: 'Saber Pro', group: 'Tableros estadisticos' },
    { key: 'gestion_procesos', label: 'Gestion por Procesos', group: 'Tableros estadisticos' },
    { key: 'plan_accion', label: 'Plan de Accion', group: 'Tableros estadisticos' },
    { key: 'autoevaluacion', label: 'Autoevaluacion', group: 'Tableros estadisticos' },
    { key: 'registros_calificados_acreditacion', label: 'Registros Calificados y Acreditacion', group: 'Tableros estadisticos' },
    { key: 'monitor_actividad', label: 'Monitor de Actividad', group: 'Tableros estadisticos' },
    { key: 'seguridad_aplicativa', label: 'Gestión de Seguridad Aplicativa', group: 'Tableros estadisticos' },
    { key: 'autoevaluacion.instrumentos.access', label: 'Gestión de Instrumentos', group: 'Autoevaluacion' },
    { key: 'seguridad_aplicativa.ver', label: 'Ver modulo', group: 'Seguridad Aplicativa' },
    { key: 'seguridad_aplicativa.escanear', label: 'Ejecutar escaneo', group: 'Seguridad Aplicativa' },
    { key: 'seguridad_aplicativa.ver_hallazgos', label: 'Ver hallazgos', group: 'Seguridad Aplicativa' },
    { key: 'seguridad_aplicativa.gestionar_hallazgos', label: 'Gestionar hallazgos', group: 'Seguridad Aplicativa' },
    { key: 'seguridad_aplicativa.analizar_remediacion', label: 'Analizar remediacion', group: 'Seguridad Aplicativa' },
    { key: 'seguridad_aplicativa.exportar', label: 'Exportar', group: 'Seguridad Aplicativa' },
    { key: 'seguridad_aplicativa.configurar', label: 'Configurar', group: 'Seguridad Aplicativa' }
  ];
  const GI_MODULE_GROUPS = ['Acceso general', 'Tableros estadisticos', 'Autoevaluacion', 'Seguridad Aplicativa']
    .map((title) => ({
      title,
      options: GI_MODULE_OPTIONS.filter((item) => item.group === title && item.key !== 'saber_pro')
    }));
  const GESTION_PROCESOS_DASHBOARD_OPTIONS = [
    { key: 'estadistica_documental', label: 'Estadística Documental' },
    { key: 'aseguramiento_calidad', label: 'Administración del Sistema Documental' },
    { key: 'buscar_documentos', label: 'Consulta de documentos' },
    { key: 'favoritos', label: 'Documentos favoritos' },
    { key: 'gestion_usuarios_consulta', label: 'Gestión de Usuarios (Solo Consulta)' }
  ];
  const POBLACIONAL_DASHBOARD_OPTIONS = [
    { key: 'poblacional_flujo', label: 'Inscritos / Admitidos / Primer Curso' },
    { key: 'poblacional_matriculados', label: 'Matriculados' },
    { key: 'poblacional_graduados', label: 'Graduados' },
    { key: 'poblacional_caracterizacion', label: 'Caracterización' },
    { key: 'poblacional_desercion', label: 'Deserción' },
    { key: 'poblacional_empleabilidad', label: 'Empleabilidad' },
    { key: 'poblacional_contexto_externo', label: 'Contexto Externo' },
    { key: 'poblacional_saber_pro', label: 'Saber Pro (interno)' }
  ];

  const INFRAESTRUCTURA_FISICA_DASHBOARD_OPTIONS = [
    { key: 'infraestructura_fisica_crud', label: 'Gestión de Inventario Físico' },
    { key: 'infraestructura_fisica_estadistica', label: 'Información Estadística' },
    { key: 'infraestructura_fisica_informes', label: 'Generación de Informes' }
  ];

  const INTERNACIONALIZACION_DASHBOARD_OPTIONS = [
    { key: 'internacionalizacion_gestion', label: 'Gestión Estadística' },
    { key: 'internacionalizacion_estadistica', label: 'Estadística de Movilidad' },
    { key: 'internacionalizacion_convenios', label: 'Convenios' }
  ];

  const PLAN_ACCION_DASHBOARD_OPTIONS = [
    { key: 'plan_accion_estadistica', label: 'Estadística Plan de Acción' },
    { key: 'plan_accion_gestion', label: 'Gestión de Planes de Acción' }
  ];

  const SABER_PRO_PERMISSION_GROUPS = [
    {
      title: 'Consulta y validación',
      options: [
        { key: 'saber_pro_consulta_individual', label: 'Consulta individual' },
        { key: 'saber_pro_validacion_masiva', label: 'Validación masiva' }
      ]
    },
    {
      title: 'Resultados individuales',
      options: [
        { key: 'saber_pro_individuales_general', label: 'General resultados individuales' },
        { key: 'saber_pro_individuales_saber_pro', label: 'Resultados Saber Pro' },
        { key: 'saber_pro_individuales_tyt', label: 'Resultados TyT' },
        { key: 'saber_pro_individuales_destacados', label: 'Resultados destacados' },
        { key: 'saber_pro_individuales_competencias', label: 'Rendimiento por competencia' },
        { key: 'saber_pro_individuales_becas', label: 'Becas por rendimiento general' }
      ]
    },
    {
      title: 'Resultados agregados',
      options: [
        { key: 'saber_pro_agregados_general', label: 'Resultados Saber Pro agregados' },
        { key: 'saber_pro_agregados_competencias_especificas', label: 'Agregados competencias específicas' },
        { key: 'saber_pro_agregados_competencias_genericas', label: 'Agregados competencias genéricas' },
        { key: 'saber_pro_agregados_comparativo_general', label: 'Comparativo Saber Pro' },
        { key: 'saber_pro_agregados_comparativo_especificas', label: 'Comparativo específicas' }
      ]
    },
    {
      title: 'Valor agregado',
      options: [
        { key: 'saber_pro_valor_agregado_individual', label: 'Valor agregado individual' },
        { key: 'saber_pro_valor_agregado_resultado_general', label: 'Valor agregado resultado general' },
        { key: 'saber_pro_valor_agregado_estadistica_general', label: 'Valor agregado estadística general' },
        { key: 'saber_pro_valor_agregado_nbc', label: 'Valor agregado NBC' },
        { key: 'saber_pro_valor_agregado_programas', label: 'Valor agregado programas' },
        { key: 'saber_pro_valor_agregado_institucional', label: 'Valor agregado institucional' }
      ]
    }
  ];

  const RECURSO_HUMANO_PERMISSION_GROUPS = [
    {
      title: 'Módulos',
      options: [
        { key: 'recurso_humano_profesores', label: 'Profesores' },
        { key: 'recurso_humano_administrativos', label: 'Administrativos y Directivos' },
        { key: 'recurso_humano_seguimiento', label: 'Seguimiento a reportes (RRHH)' }
      ]
    }
  ];

  const { enqueueSnackbar } = useSnackbar();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
    const [search, setSearch] = useState('');
  const [filterDependencia, setFilterDependencia] = useState([]);
  const searchRef = useRef('');
  const searchFetchIdRef = useRef(0);

  // Modales
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('create'); // create | edit
  const [selectedUser, setSelectedUser] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const [bulkImportResult, setBulkImportResult] = useState(null);
  const [bulkErrorFile, setBulkErrorFile] = useState(null);
  const [bulkWarningFile, setBulkWarningFile] = useState(null);
  const [sendBulkEmails, setSendBulkEmails] = useState(false);
  const [operationType, setOperationType] = useState('sync'); // sync | replace
  const [confirmReplaceOpen, setConfirmReplaceOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingUserIds, setDeletingUserIds] = useState(() => new Set());
  const [confirmUserAction, setConfirmUserAction] = useState({ open: false, type: '', user: null });
  const [confirmUserSubmitting, setConfirmUserSubmitting] = useState(false);
  const [openPermissionsDialog, setOpenPermissionsDialog] = useState(false);
  const [permissionsUser, setPermissionsUser] = useState(null);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [openClearConfirmDialog, setOpenClearConfirmDialog] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');
  const [clearSubmitting, setClearSubmitting] = useState(false);
  const [permissionsSaving, setPermissionsSaving] = useState(false);
  const [suggestionUsers, setSuggestionUsers] = useState([]);
  const [fieldSuggestions, setFieldSuggestions] = useState({ dependencias: [], cargos: [], jefesInmediatos: [] });
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [modulePermissionsForm, setModulePermissionsForm] = useState({
    menuPermissions: [],
    allowedModules: [],
    allowedGestionProcesosDashboards: [],
    allowedPoblacionalDashboards: [],
    allowedSaberProDashboards: [],
    allowedRecursoHumanoDashboards: [],
    allowedInfraestructuraFisicaDashboards: [],
    allowedPlanAccionDashboards: [],
    allowedInternacionalizacionDashboards: []
  });

  // Formulario
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    username: '',
    dependencia: '',
    cargo: '',
    jefe_inmediato: '',
    role: ROLES.CONSULTA
  });
  const [formErrors, setFormErrors] = useState({
    nombre: '',
    email: '',
    username: ''
  });

  const allowedRolesForManager = useMemo(() => {
    if (currentUser?.role === ROLES.ADMINISTRADOR) {
      return [
        ROLES.ADMINISTRADOR,
        ROLES.PLANEACION_ESTRATEGICA,
        ROLES.PLANEACION_EFECTIVIDAD,
        ROLES.AUTOEVALUACION,
        ROLES.REGISTROS_CALIFICADOS,
        ROLES.GESTION_INFORMACION,
        ROLES.GESTION_PROCESOS,
        ROLES.CONSULTA,
        ROLES.PRUEBA
      ];
    }

    if (currentUser?.role === ROLES.PLANEACION_ESTRATEGICA) {
      return [
        ROLES.PLANEACION_ESTRATEGICA,
        ROLES.PLANEACION_EFECTIVIDAD,
        ROLES.AUTOEVALUACION,
        ROLES.REGISTROS_CALIFICADOS,
        ROLES.GESTION_INFORMACION
      ];
    }

    if (currentUser?.role === ROLES.GESTION_PROCESOS || currentUser?.role === ROLES.CONSULTA) {
      return [ROLES.CONSULTA];
    }

    return [];
  }, [currentUser?.role]);

  const defaultAssignableRole = allowedRolesForManager[0] || ROLES.CONSULTA;
  const canManageModulePermissions = currentUser?.role === ROLES.ADMINISTRADOR;
  const isCurrentUserRow = useCallback((row = {}) => {
    const currentId = Number(currentUser?.id || 0);
    const rowId = Number(row?.id || 0);
    const currentEmail = String(currentUser?.email || '').trim().toLowerCase();
    const rowEmail = String(row?.email || '').trim().toLowerCase();
    const currentDoc = String(currentUser?.username || '').trim();
    const rowDoc = String(row?.username || '').trim();
    return Boolean(
      (currentId && rowId && currentId === rowId) ||
      (currentEmail && rowEmail && currentEmail === rowEmail) ||
      (currentDoc && rowDoc && currentDoc === rowDoc)
    );
  }, [currentUser?.email, currentUser?.id, currentUser?.username]);

  const loadUsers = useCallback(async (overrides = {}) => {
    const nextPage = Object.prototype.hasOwnProperty.call(overrides, 'page') ? overrides.page : page;
    const nextLimit = Object.prototype.hasOwnProperty.call(overrides, 'rowsPerPage') ? overrides.rowsPerPage : rowsPerPage;
    const nextSearch = Object.prototype.hasOwnProperty.call(overrides, 'search') ? overrides.search : searchRef.current;
    const silent = overrides.silent === true;
    if (!silent) {
      setLoading(true);
    }
    try {
      const response = await userService.getUsers({
        page: nextPage + 1,
        limit: nextLimit,
        search: nextSearch
      });
      setUsers(response.data.users);
      setTotal(response.data.pagination.total);
    } catch (error) {
      if (!silent) {
        enqueueSnackbar('Error al cargar usuarios', { variant: 'error' });
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [enqueueSnackbar, page, rowsPerPage]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    searchRef.current = search;
  }, [search]);

  useEffect(() => {
    const requestId = searchFetchIdRef.current + 1;
    searchFetchIdRef.current = requestId;
    const nextSearch = search.trim();
    const timer = setTimeout(() => {
      userService.getUsers({ page: 1, limit: rowsPerPage, search: nextSearch })
        .then((response) => {
          if (searchFetchIdRef.current !== requestId) return;
          setUsers(response.data.users);
          setTotal(response.data.pagination.total);
        })
        .catch(() => {
          // La busqueda en vivo es silenciosa para no interrumpir la escritura.
        });
    }, 450);
    return () => clearTimeout(timer);
  }, [rowsPerPage, search]);

  const handleOpenDialog = (mode, user = null) => {
    setDialogMode(mode);
    setSelectedUser(user);
    if (user) {
      setFormData({
        nombre: user.nombre,
        email: user.email,
        username: user.username,
        dependencia: user.dependencia || '',
        cargo: user.cargo || '',
        jefe_inmediato: user.jefe_inmediato || '',
        role: user.role
      });
    } else {
      setFormData({
        nombre: '',
        email: '',
        username: '',
        dependencia: '',
        cargo: '',
        jefe_inmediato: '',
        role: defaultAssignableRole
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedUser(null);
    setFormData({ nombre: '', email: '', username: '', dependencia: '', cargo: '', jefe_inmediato: '', role: defaultAssignableRole });
    setFormErrors({ nombre: '', email: '', username: '' });
  };

  const validateUserForm = () => {
    const nextErrors = { nombre: '', email: '', username: '' };
    const normalizedName = String(formData.nombre || '').trim();
    const normalizedEmail = String(formData.email || '').trim().toLowerCase();
    const normalizedDocument = String(formData.username || '').trim();

    if (!/^[0-9]{4,15}$/.test(normalizedDocument)) {
      nextErrors.username = 'El número de documento debe contener solo números (4 a 15 dígitos).';
    }

    if (!normalizedName) {
      nextErrors.nombre = 'El nombre completo es obligatorio.';
    } else if (/^[0-9]+$/.test(normalizedName)) {
      nextErrors.nombre = 'El nombre no puede contener solo números.';
    }

    if (!normalizedEmail) {
      nextErrors.email = 'El correo institucional es obligatorio.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      nextErrors.email = 'Ingresa un correo electrónico válido.';
    } else if (!normalizedEmail.endsWith('@unicesmag.edu.co')) {
      nextErrors.email = 'El correo debe terminar en @unicesmag.edu.co.';
    }

    setFormErrors(nextErrors);
    return !nextErrors.nombre && !nextErrors.email && !nextErrors.username;
  };

  const handleSubmit = async () => {
    if (!validateUserForm()) return;

    try {
      const payload = {
        ...formData,
        nombre: String(formData.nombre || '').trim(),
        email: String(formData.email || '').trim().toLowerCase(),
        username: String(formData.username || '').trim(),
        dependencia: String(formData.dependencia || '').trim(),
        cargo: String(formData.cargo || '').trim(),
        jefe_inmediato: String(formData.jefe_inmediato || '').trim()
      };

      if (dialogMode === 'create') {
        const response = await userService.createUser(payload);
        enqueueSnackbar(response.message || 'Usuario creado exitosamente', { variant: 'success' });
      } else {
        await userService.updateUser(selectedUser.id, payload);
        enqueueSnackbar('Usuario actualizado exitosamente', { variant: 'success' });
      }
      handleCloseDialog();
      loadUsers();
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'Error al guardar usuario', { variant: 'error' });
    }
  };

  const handleDelete = (user) => {
    if (isCurrentUserRow(user)) {
      enqueueSnackbar('No puedes eliminar tu propio usuario activo.', { variant: 'warning' });
      return;
    }
    if (deletingUserIds.has(user.id)) return;
    setConfirmUserAction({ open: true, type: 'delete', user });
  };

  const executeDelete = async (user) => {
    setDeletingUserIds((prev) => new Set(prev).add(user.id));
    setUsers((prev) => prev.filter((item) => item.id !== user.id));
    setTotal((prev) => Math.max(prev - 1, 0));
    if (users.length === 1 && page > 0) {
      setPage((prev) => Math.max(prev - 1, 0));
    }
    try {
      const response = await userService.deleteUser(user.id);
      const deletedPhysically = response?.data?.deletedPhysically !== false;

      enqueueSnackbar(
        response.message || (deletedPhysically ? 'Usuario eliminado' : 'Usuario retirado'),
        { variant: 'success' }
      );
    } catch (error) {
      if (Number(error.response?.status) === 404) {
        enqueueSnackbar('Usuario ya retirado', { variant: 'info' });
        return;
      }

      await loadUsers();

      if (error.code === 'ECONNABORTED') {
        enqueueSnackbar('Tabla sincronizada', { variant: 'warning' });
        return;
      }

      enqueueSnackbar(error.response?.data?.message || 'Error al eliminar usuario', { variant: 'error' });
    } finally {
      setDeletingUserIds((prev) => {
        const next = new Set(prev);
        next.delete(user.id);
        return next;
      });
    }
  };

  const handleToggleStatus = (user) => {
    if (isCurrentUserRow(user) && user.estado === 'activo') {
      enqueueSnackbar('No puedes inactivar tu propio usuario activo.', { variant: 'warning' });
      return;
    }
    setConfirmUserAction({ open: true, type: user.estado === 'activo' ? 'deactivate' : 'reactivate', user });
  };

  const executeToggleStatus = async (user) => {
    const nextEstado = user.estado === 'activo' ? 'inactivo' : 'activo';
    const actionText = nextEstado === 'activo' ? 'reactivar' : 'inactivar';

    try {
      const response = await userService.updateStatus(user.id, nextEstado);
      setUsers((prev) =>
        prev.map((item) =>
          item.id === user.id ? { ...item, estado: nextEstado } : item
        )
      );
      enqueueSnackbar(response.message || `Usuario ${actionText}do exitosamente`, { variant: 'success' });
      loadUsers();
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || `Error al ${actionText} usuario`, { variant: 'error' });
    }
  };

  const handleCloseConfirmUserAction = () => {
    if (confirmUserSubmitting) return;
    setConfirmUserAction({ open: false, type: '', user: null });
  };

  const handleConfirmUserAction = async () => {
    const { type, user } = confirmUserAction;
    if (!type || !user) return;
    setConfirmUserSubmitting(true);
    try {
      if (type === 'delete') {
        await executeDelete(user);
      } else {
        await executeToggleStatus(user);
      }
      setConfirmUserAction({ open: false, type: '', user: null });
    } finally {
      setConfirmUserSubmitting(false);
    }
  };
  const handleDownloadTemplate = async () => {
    try {
      const blob = await userService.downloadTemplate();
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'plantilla_usuarios_sgc.xlsx';
      link.click();
    } catch (error) {
      enqueueSnackbar('Error al descargar plantilla', { variant: 'error' });
    }
  };

  const handleDownloadPendingNotifications = async () => {
    try {
      const data = await userService.downloadPendingNotifications();
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'usuarios_sin_notificar_sgc.xlsx';
      link.click();
      enqueueSnackbar('Listado de pendientes descargado con éxito', { variant: 'success' });
    } catch (err) {
      console.error('Error al descargar listado de pendientes:', err);
      enqueueSnackbar('Error al descargar listado de pendientes', { variant: 'error' });
    }
  };

  const handleSendPendingNotifications = async () => {
    try {
      const res = await userService.sendPendingNotifications();
      if (res.success) {
        enqueueSnackbar(res.message, { variant: 'success' });
      } else {
        enqueueSnackbar(res.message || 'Error al iniciar el envío', { variant: 'warning' });
      }
    } catch (err) {
      console.error('Error al enviar correos pendientes:', err);
      enqueueSnackbar('Error al iniciar el envío de notificaciones', { variant: 'error' });
    }
  };

  const handleClearAllUsers = async () => {
    if (clearConfirmText !== 'ELIMINAR') {
      enqueueSnackbar('Debes escribir la palabra "ELIMINAR" para confirmar.', { variant: 'warning' });
      return;
    }
    setClearSubmitting(true);
    try {
      const res = await userService.clearAllUsers();
      if (res.success) {
        enqueueSnackbar(res.message, { variant: 'success' });
        setOpenClearConfirmDialog(false);
        setClearConfirmText('');
        setPage(0);
        await loadUsers({ page: 0, search: '' });
      } else {
        enqueueSnackbar(res.message || 'Error al limpiar usuarios', { variant: 'error' });
      }
    } catch (err) {
      console.error('Error al limpiar usuarios:', err);
      enqueueSnackbar('Error al vaciar los usuarios del sistema', { variant: 'error' });
    } finally {
      setClearSubmitting(false);
    }
  };

  const downloadBase64Excel = (base64, filename) => {
    if (!base64) return;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const resetTableAfterBulkImport = async () => {
    setSearch('');
    setPage(0);
    await loadUsers({ page: 0, search: '' });
  };

  const handleClearTools = () => {
    setSearch('');
    setUploadFile(null);
    setBulkImportResult(null);
    setBulkErrorFile(null);
    setBulkWarningFile(null);
    setUploadInputKey((prev) => prev + 1);
    setPage(0);
    loadUsers({ page: 0, search: '' });
  };

  const handleExportUsuarios = () => {
    const dataToExport = filterDependencia.length === 0 ? users : visibleUsers;
    const excelData = dataToExport.map(u => ({
      NUMERO_DOCUMENTO: u.username || '',
      NOMBRE_COMPLETO: u.nombre || '',
      CORREO_INSTITUCIONAL: u.email || '',
      DEPENDENCIA: u.dependencia || '',
      CARGO: u.cargo || '',
      'JEFE INMEDIATO': u.jefe_inmediato || '',
      ROL: ROLE_LABELS[u.role] || u.role || '',
      ESTADO: u.estado || ''
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);

    // Apply styles to headers
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
      if (!ws[cellAddress]) continue;
      ws[cellAddress].s = {
        fill: { fgColor: { rgb: "1e40af" } },
        font: { color: { rgb: "FFFFFF" }, bold: true },
        alignment: { horizontal: "center", vertical: "center" }
      };
    }

    const colWidths = [
      { wch: 20 },
      { wch: 40 },
      { wch: 35 },
      { wch: 35 },
      { wch: 35 },
      { wch: 35 },
      { wch: 15 },
      { wch: 15 }
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Usuarios');
    
    const fileName = filterDependencia.length === 0 
      ? 'Base_Usuarios_Completa.xlsx' 
      : 'Usuarios_Filtrados.xlsx';
      
    XLSX.writeFile(wb, fileName);
  };

  const executeBulkUpload = async () => {
    setUploading(true);
    setBulkImportResult(null);
    setBulkErrorFile(null);
    setBulkWarningFile(null);
    try {
      const response = await userService.bulkUpload(uploadFile, {
        sendEmails: sendBulkEmails,
        operationType: operationType
      });
      const result = response?.data || {};

      setBulkImportResult(result);
      setBulkErrorFile(response.archivoErrores || null);
      setBulkWarningFile(response.archivoAdvertencias || null);

      if (response.archivoErrores) {
        downloadBase64Excel(response.archivoErrores, 'errores_carga_usuarios.xlsx');
      }

      enqueueSnackbar(response.message || 'Carga masiva finalizada', {
        variant: result.errores?.length ? 'warning' : 'success'
      });
      setUploadFile(null);
      setUploadInputKey((prev) => prev + 1);
      await resetTableAfterBulkImport();
    } catch (error) {
      const response = error.response?.data;
      if (response?.archivoErrores) {
        setBulkErrorFile(response.archivoErrores);
        downloadBase64Excel(response.archivoErrores, 'errores_carga_usuarios.xlsx');
      }
      if (response?.data) {
        setBulkImportResult(response.data);
      }
      enqueueSnackbar(response?.message || 'Error en carga masiva', { variant: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleBulkUploadProfessional = async () => {
    if (!uploadFile) {
      enqueueSnackbar('Seleccione un archivo Excel', { variant: 'warning' });
      return;
    }

    if (operationType === 'replace') {
      setConfirmReplaceOpen(true);
    } else {
      await executeBulkUpload();
    }
  };

  const handleTogglePermission = (group, key) => {
    setModulePermissionsForm((prev) => {
      if (group === 'menuPermissions') {
        const current = prev.menuPermissions || [];
        const isSelected = current.includes(key);
        let next = isSelected ? current.filter((x) => x !== key) : [...current, key];
        let nextModules = Array.isArray(prev.allowedModules) ? [...prev.allowedModules] : [];

        if (key === 'autoevaluacion' && isSelected) {
           nextModules = nextModules.filter(k => k !== 'autoevaluacion.instrumentos.access');
        }

        return { ...prev, menuPermissions: next, allowedModules: nextModules };
      }

      const current = Array.isArray(prev[group]) ? prev[group] : [];
      const isSelected = current.includes(key);
      const next = isSelected ? current.filter((x) => x !== key) : [...current, key];

      // Si se marca un submódulo de Gestión de la Información, se habilita automáticamente
      // el menú padre para evitar estados inconsistentes en la interfaz.
      if (group === 'allowedModules') {
        let nextModules = [...next];
        const nextMenu = Array.isArray(prev.menuPermissions) ? [...prev.menuPermissions] : [];
        let nextGestionProcesosDashboards = Array.isArray(prev.allowedGestionProcesosDashboards) ? [...prev.allowedGestionProcesosDashboards] : [];
        let nextPoblacionalDashboards = Array.isArray(prev.allowedPoblacionalDashboards) ? [...prev.allowedPoblacionalDashboards] : [];
        let nextSaberProDashboards = Array.isArray(prev.allowedSaberProDashboards) ? [...prev.allowedSaberProDashboards] : [];
        let nextRecursoHumanoDashboards = Array.isArray(prev.allowedRecursoHumanoDashboards) ? [...prev.allowedRecursoHumanoDashboards] : [];
        let nextInfraestructuraFisicaDashboards = Array.isArray(prev.allowedInfraestructuraFisicaDashboards) ? [...prev.allowedInfraestructuraFisicaDashboards] : [];
        let nextPlanAccionDashboards = Array.isArray(prev.allowedPlanAccionDashboards) ? [...prev.allowedPlanAccionDashboards] : [];
        let nextInternacionalizacionDashboards = Array.isArray(prev.allowedInternacionalizacionDashboards) ? [...prev.allowedInternacionalizacionDashboards] : [];

        const isTablero = !['gestion_bases_datos', 'estadistica_institucional'].includes(key);

        if (isTablero) {
          if (!isSelected) {
            // Se marca un tablero
            if (!nextModules.includes('estadistica_institucional')) nextModules.push('estadistica_institucional');
            if (!nextMenu.includes('gestion_informacion')) nextMenu.push('gestion_informacion');
          } else {
            // Se desmarca un tablero
            if (key === 'seguridad_aplicativa') {
              nextModules = nextModules.filter(k => !k.startsWith('seguridad_aplicativa.'));
            }
            if (key === 'autoevaluacion') {
              nextModules = nextModules.filter(k => k !== 'autoevaluacion.instrumentos.access');
            }
            const hasTableros = nextModules.some(k => !['gestion_bases_datos', 'estadistica_institucional'].includes(k) && !k.startsWith('seguridad_aplicativa.') && k !== 'autoevaluacion.instrumentos.access');
            if (!hasTableros) {
              nextModules = nextModules.filter(k => k !== 'estadistica_institucional');
              if (!nextModules.includes('gestion_bases_datos')) {
                const idx = nextMenu.indexOf('gestion_informacion');
                if (idx !== -1) nextMenu.splice(idx, 1);
              }
            }
          }
        } else if (key === 'estadistica_institucional') {
          if (!isSelected) {
            if (!nextMenu.includes('gestion_informacion')) nextMenu.push('gestion_informacion');
          } else {
            // Se desmarca estadistica_institucional manualmente -> desmarcar TODOS los tableros
            nextModules = nextModules.filter(k => ['gestion_bases_datos'].includes(k));
            if (!nextModules.includes('gestion_bases_datos')) {
              const idx = nextMenu.indexOf('gestion_informacion');
              if (idx !== -1) nextMenu.splice(idx, 1);
            }
          }
        } else if (key === 'gestion_bases_datos') {
          if (!isSelected) {
            if (!nextMenu.includes('gestion_informacion')) nextMenu.push('gestion_informacion');
          } else {
            if (!nextModules.includes('estadistica_institucional')) {
              const idx = nextMenu.indexOf('gestion_informacion');
              if (idx !== -1) nextMenu.splice(idx, 1);
            }
          }
        } else if (key.startsWith('seguridad_aplicativa.') || key === 'autoevaluacion.instrumentos.access') {
          // If a child of seguridad_aplicativa is selected, ensure the parent is selected
          if (!isSelected) {
             if (key.startsWith('seguridad_aplicativa.') && !nextModules.includes('seguridad_aplicativa')) nextModules.push('seguridad_aplicativa');
             if (key === 'autoevaluacion.instrumentos.access' && !nextModules.includes('autoevaluacion')) nextModules.push('autoevaluacion');
             if (!nextModules.includes('estadistica_institucional')) nextModules.push('estadistica_institucional');
             if (!nextMenu.includes('gestion_informacion')) nextMenu.push('gestion_informacion');
          }
        }

        if (!nextModules.includes('estadistica_institucional')) {
          nextPoblacionalDashboards = [];
          nextGestionProcesosDashboards = [];
          nextSaberProDashboards = [];
          nextRecursoHumanoDashboards = [];
          nextInfraestructuraFisicaDashboards = [];
          nextPlanAccionDashboards = [];
          nextInternacionalizacionDashboards = [];
        } else {
          if (!nextModules.includes('poblacional')) nextPoblacionalDashboards = [];
          if (!nextModules.includes('gestion_procesos')) nextGestionProcesosDashboards = [];
          if (!nextModules.includes('saber_pro')) nextSaberProDashboards = [];
          if (!nextModules.includes('recurso_humano')) nextRecursoHumanoDashboards = [];
          if (!nextModules.includes('infraestructura_fisica')) nextInfraestructuraFisicaDashboards = [];
          if (!nextModules.includes('plan_accion')) nextPlanAccionDashboards = [];
          if (!nextModules.includes('internacionalizacion')) nextInternacionalizacionDashboards = [];
        }

        return {
          ...prev,
          allowedModules: nextModules,
          menuPermissions: nextMenu,
          allowedGestionProcesosDashboards: nextGestionProcesosDashboards,
          allowedPoblacionalDashboards: nextPoblacionalDashboards,
          allowedSaberProDashboards: nextSaberProDashboards,
          allowedRecursoHumanoDashboards: nextRecursoHumanoDashboards,
          allowedInfraestructuraFisicaDashboards: nextInfraestructuraFisicaDashboards,
          allowedPlanAccionDashboards: nextPlanAccionDashboards,
          allowedInternacionalizacionDashboards: nextInternacionalizacionDashboards
        };
      }

      if (group === 'allowedGestionProcesosDashboards') {
        const nextMenu = Array.isArray(prev.menuPermissions) ? [...prev.menuPermissions] : [];
        const nextModules = Array.isArray(prev.allowedModules) ? [...prev.allowedModules] : [];
        if (next.length > 0) {
          if (!nextMenu.includes('gestion_informacion')) nextMenu.push('gestion_informacion');
          if (!nextModules.includes('estadistica_institucional')) nextModules.push('estadistica_institucional');
          if (!nextModules.includes('gestion_procesos')) nextModules.push('gestion_procesos');
        }
        return { ...prev, allowedGestionProcesosDashboards: next, allowedModules: nextModules, menuPermissions: nextMenu };
      }

      if (group === 'allowedPoblacionalDashboards') {
        const nextMenu = Array.isArray(prev.menuPermissions) ? [...prev.menuPermissions] : [];
        const nextModules = Array.isArray(prev.allowedModules) ? [...prev.allowedModules] : [];
        if (next.length > 0) {
          if (!nextMenu.includes('gestion_informacion')) nextMenu.push('gestion_informacion');
          if (!nextModules.includes('estadistica_institucional')) nextModules.push('estadistica_institucional');
          if (!nextModules.includes('poblacional')) nextModules.push('poblacional');
        }
        return { ...prev, allowedPoblacionalDashboards: next, allowedModules: nextModules, menuPermissions: nextMenu };
      }

      if (group === 'allowedSaberProDashboards') {
        const nextMenu = Array.isArray(prev.menuPermissions) ? [...prev.menuPermissions] : [];
        const nextModules = Array.isArray(prev.allowedModules) ? [...prev.allowedModules] : [];
        if (next.length > 0) {
          if (!nextMenu.includes('gestion_informacion')) nextMenu.push('gestion_informacion');
          if (!nextModules.includes('estadistica_institucional')) nextModules.push('estadistica_institucional');
          if (!nextModules.includes('saber_pro')) nextModules.push('saber_pro');
        }
        return { ...prev, allowedSaberProDashboards: next, allowedModules: nextModules, menuPermissions: nextMenu };
      }

      if (group === 'allowedRecursoHumanoDashboards') {
        const nextMenu = Array.isArray(prev.menuPermissions) ? [...prev.menuPermissions] : [];
        const nextModules = Array.isArray(prev.allowedModules) ? [...prev.allowedModules] : [];
        if (next.length > 0) {
          if (!nextMenu.includes('gestion_informacion')) nextMenu.push('gestion_informacion');
          if (!nextModules.includes('estadistica_institucional')) nextModules.push('estadistica_institucional');
          if (!nextModules.includes('recurso_humano')) nextModules.push('recurso_humano');
        }
        return { ...prev, allowedRecursoHumanoDashboards: next, allowedModules: nextModules, menuPermissions: nextMenu };
      }

      if (group === 'allowedInfraestructuraFisicaDashboards') {
        const nextMenu = Array.isArray(prev.menuPermissions) ? [...prev.menuPermissions] : [];
        const nextModules = Array.isArray(prev.allowedModules) ? [...prev.allowedModules] : [];
        if (next.length > 0) {
          if (!nextMenu.includes('gestion_informacion')) nextMenu.push('gestion_informacion');
          if (!nextModules.includes('estadistica_institucional')) nextModules.push('estadistica_institucional');
          if (!nextModules.includes('infraestructura_fisica')) nextModules.push('infraestructura_fisica');
        }
        return { ...prev, allowedInfraestructuraFisicaDashboards: next, allowedModules: nextModules, menuPermissions: nextMenu };
      }

      if (group === 'allowedInternacionalizacionDashboards') {
        const nextMenu = Array.isArray(prev.menuPermissions) ? [...prev.menuPermissions] : [];
        const nextModules = Array.isArray(prev.allowedModules) ? [...prev.allowedModules] : [];
        if (next.length > 0) {
          if (!nextMenu.includes('gestion_informacion')) nextMenu.push('gestion_informacion');
          if (!nextModules.includes('estadistica_institucional')) nextModules.push('estadistica_institucional');
          if (!nextModules.includes('internacionalizacion')) nextModules.push('internacionalizacion');
        }
        return { ...prev, allowedInternacionalizacionDashboards: next, allowedModules: nextModules, menuPermissions: nextMenu };
      }

      if (group === 'allowedPlanAccionDashboards') {
        const nextMenu = Array.isArray(prev.menuPermissions) ? [...prev.menuPermissions] : [];
        const nextModules = Array.isArray(prev.allowedModules) ? [...prev.allowedModules] : [];
        if (next.length > 0) {
          if (!nextMenu.includes('gestion_informacion')) nextMenu.push('gestion_informacion');
          if (!nextModules.includes('estadistica_institucional')) nextModules.push('estadistica_institucional');
          if (!nextModules.includes('plan_accion')) nextModules.push('plan_accion');
        }
        return { ...prev, allowedPlanAccionDashboards: next, allowedModules: nextModules, menuPermissions: nextMenu };
      }

      // Si se quita el menú padre de Gestión de la Información, se limpian sus submódulos.
      if (group === 'menuPermissions' && key === 'gestion_informacion' && isSelected) {
        return {
          ...prev,
          menuPermissions: next,
          allowedModules: [],
          allowedGestionProcesosDashboards: [],
          allowedPoblacionalDashboards: [],
          allowedSaberProDashboards: [],
          allowedRecursoHumanoDashboards: [],
          allowedInfraestructuraFisicaDashboards: [],
          allowedPlanAccionDashboards: [],
          allowedInternacionalizacionDashboards: []
        };
      }

      return { ...prev, [group]: next };
    });
  };

  const handleOpenPermissionsDialog = async (user) => {
    if (!canManageModulePermissions) {
      enqueueSnackbar('Solo el Administrador General puede asignar permisos de módulos', { variant: 'warning' });
      return;
    }

    setPermissionsUser(user);
    setOpenPermissionsDialog(true);
    setPermissionsLoading(true);
    try {
      const response = await userService.getModulePermissions(user.id);
      const permissions = response?.data?.permissions || {};
      const menuPermissions = Object.entries(permissions)
        .filter(([key, value]) => MENU_PERMISSION_OPTIONS.some((o) => o.key === key) && value?.can_view)
        .map(([key]) => key);
      const allowedModules = Object.entries(permissions)
        .filter(([key, value]) => GI_MODULE_OPTIONS.some((o) => o.key === key) && value?.can_view)
        .map(([key]) => key);
      const allowedGestionProcesosDashboards = Object.entries(permissions)
        .filter(([key, value]) => GESTION_PROCESOS_DASHBOARD_OPTIONS.some((o) => o.key === key) && value?.can_view)
        .map(([key]) => key);
      const allowedPoblacionalDashboards = Object.entries(permissions)
        .filter(([key, value]) => POBLACIONAL_DASHBOARD_OPTIONS.some((o) => o.key === key) && value?.can_view)
        .map(([key]) => key);
      const allowedSaberProDashboards = Object.entries(permissions)
        .filter(([key, val]) => val && SABER_PRO_PERMISSION_GROUPS.some((g) => g.options.some((opt) => opt.key === key)))
        .map(([key]) => key);
      const allowedRecursoHumanoDashboards = Object.entries(permissions)
        .filter(([key, val]) => val && RECURSO_HUMANO_PERMISSION_GROUPS.some((g) => g.options.some((opt) => opt.key === key)))
        .map(([key]) => key);

      const allowedInfraestructuraFisicaDashboards = Object.entries(permissions)
        .filter(([key, val]) => val && INFRAESTRUCTURA_FISICA_DASHBOARD_OPTIONS.some((o) => o.key === key))
        .map(([key]) => key);
      const allowedPlanAccionDashboards = Object.entries(permissions)
        .filter(([key, val]) => val && PLAN_ACCION_DASHBOARD_OPTIONS.some((o) => o.key === key))
        .map(([key]) => key);

      const allowedInternacionalizacionDashboards = Object.entries(permissions)
        .filter(([key, val]) => val && INTERNACIONALIZACION_DASHBOARD_OPTIONS.some((o) => o.key === key))
        .map(([key]) => key);

      setModulePermissionsForm({
        menuPermissions: (allowedModules.length > 0 || allowedGestionProcesosDashboards.length > 0 || allowedPoblacionalDashboards.length > 0 || allowedSaberProDashboards.length > 0 || allowedRecursoHumanoDashboards.length > 0 || allowedInfraestructuraFisicaDashboards.length > 0 || allowedPlanAccionDashboards.length > 0 || allowedInternacionalizacionDashboards.length > 0) && !menuPermissions.includes('gestion_informacion')
          ? [...menuPermissions, 'gestion_informacion']
          : menuPermissions,
        allowedModules,
        allowedGestionProcesosDashboards,
        allowedPoblacionalDashboards,
        allowedSaberProDashboards,
        allowedRecursoHumanoDashboards,
        allowedInfraestructuraFisicaDashboards,
        allowedPlanAccionDashboards,
        allowedInternacionalizacionDashboards
      });
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'Error al cargar permisos de módulos', { variant: 'error' });
      setOpenPermissionsDialog(false);
      setPermissionsUser(null);
    } finally {
      setPermissionsLoading(false);
    }
  };

  const handleClosePermissionsDialog = () => {
    if (permissionsSaving) return;
    setOpenPermissionsDialog(false);
    setPermissionsUser(null);
    setModulePermissionsForm({ menuPermissions: [], allowedModules: [], allowedGestionProcesosDashboards: [], allowedPoblacionalDashboards: [], allowedSaberProDashboards: [], allowedRecursoHumanoDashboards: [], allowedInfraestructuraFisicaDashboards: [], allowedPlanAccionDashboards: [], allowedInternacionalizacionDashboards: [] });
  };

  const handleSavePermissions = async () => {
    if (!permissionsUser || !canManageModulePermissions) return;
    setPermissionsSaving(true);
    try {
      const response = await userService.updateModulePermissions(permissionsUser.id, modulePermissionsForm);
      enqueueSnackbar(response.message || 'Permisos actualizados', { variant: 'success' });
      handleClosePermissionsDialog();
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'Error al guardar permisos', { variant: 'error' });
    } finally {
      setPermissionsSaving(false);
    }
  };

  const getRoleColor = (role) => {
    if (role === ROLES.ADMINISTRADOR) return 'error';
    if (role === ROLES.PLANEACION_ESTRATEGICA) return 'secondary';
    if (role === ROLES.GESTION_INFORMACION) return 'success';
    if (role === ROLES.GESTION_PROCESOS) return 'info';
    if (role === ROLES.AUTOEVALUACION) return 'warning';
    if (role === ROLES.REGISTROS_CALIFICADOS) return 'default';
    return 'primary';
  };

  const getEstadoColor = (estado) => {
    return estado === 'activo' ? 'success' : 'default';
  };

  const getCompactRoleLabel = (role) => {
    return ROLE_LABELS[role] || role;
  };

  const wrapCellSx = {
    py: 1,
    px: { xs: 0.45, sm: 0.6, md: 0.75 },
    fontSize: { xs: 10.25, sm: 10.75, md: 11 },
    lineHeight: 1.22,
    color: '#24324a',
    textTransform: 'uppercase',
    '& .cellText': {
      whiteSpace: 'normal',
      overflowWrap: 'break-word',
      wordBreak: 'normal',
      display: 'block'
    }
  };

  const compactChipSx = {
    height: { xs: 18, sm: 19, md: 20 },
    maxWidth: '100%',
    fontSize: { xs: 8.75, sm: 9.25, md: 9.5 },
    fontWeight: 700,
    '& .MuiChip-label': {
      px: 0.55,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      lineHeight: 1,
      display: 'block'
    }
  };

  const roleChipSx = {
    ...compactChipSx,
    width: { xs: 58, sm: 62, md: 66 },
    justifyContent: 'center',
    textTransform: 'uppercase'
  };

  const statusChipSx = {
    ...compactChipSx,
    width: { xs: 56, sm: 59, md: 62 },
    justifyContent: 'center',
    textTransform: 'uppercase',
    color: '#fff'
  };

  const normalizeSearchText = useCallback((value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/_/g, ' ')
    .toLowerCase(), []);

  const buildUniqueOptions = useCallback((rows, field) => {
    const byNormalizedValue = new Map();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const value = String(row?.[field] || '').trim();
      if (!value || value === '-') return;
      const key = normalizeSearchText(value).trim();
      if (!key || byNormalizedValue.has(key)) return;
      byNormalizedValue.set(key, value);
    });
    return Array.from(byNormalizedValue.values())
      .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [normalizeSearchText]);

  const mergeUniqueOptions = useCallback((primaryOptions, rows, field) => {
    const byNormalizedValue = new Map();
    (Array.isArray(primaryOptions) ? primaryOptions : []).forEach((option) => {
      const value = String(option || '').trim();
      const key = normalizeSearchText(value).trim();
      if (value && key && !byNormalizedValue.has(key)) {
        byNormalizedValue.set(key, value);
      }
    });
    buildUniqueOptions(rows, field).forEach((option) => {
      const key = normalizeSearchText(option).trim();
      if (key && !byNormalizedValue.has(key)) {
        byNormalizedValue.set(key, option);
      }
    });
    return Array.from(byNormalizedValue.values())
      .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [buildUniqueOptions, normalizeSearchText]);

  const suggestionRows = useMemo(() => {
    const byIdOrIdentity = new Map();
    [...(Array.isArray(suggestionUsers) ? suggestionUsers : []), ...(Array.isArray(users) ? users : [])].forEach((user, index) => {
      const key = user?.id ? `id-${user.id}` : `${user?.username || ''}-${user?.email || ''}-${index}`;
      byIdOrIdentity.set(key, user);
    });
    return Array.from(byIdOrIdentity.values());
  }, [suggestionUsers, users]);

  const dependenciaOptions = useMemo(() => mergeUniqueOptions(fieldSuggestions.dependencias, suggestionRows, 'dependencia'), [fieldSuggestions.dependencias, mergeUniqueOptions, suggestionRows]);
  const cargoOptions = useMemo(() => mergeUniqueOptions(fieldSuggestions.cargos, suggestionRows, 'cargo'), [fieldSuggestions.cargos, mergeUniqueOptions, suggestionRows]);
  const jefeInmediatoOptions = useMemo(() => mergeUniqueOptions(fieldSuggestions.jefesInmediatos, suggestionRows, 'jefe_inmediato'), [fieldSuggestions.jefesInmediatos, mergeUniqueOptions, suggestionRows]);

  useEffect(() => {
    if (!openDialog) return undefined;
    let ignore = false;
    const loadSuggestionUsers = async () => {
      setLoadingSuggestions(true);
      try {
        const response = await userService.getSuggestions();
        if (!ignore) {
          setFieldSuggestions({
            dependencias: response?.data?.dependencias || [],
            cargos: response?.data?.cargos || [],
            jefesInmediatos: response?.data?.jefesInmediatos || []
          });
        }
      } catch (error) {
        if (!ignore) {
          setSuggestionUsers(users);
        }
      } finally {
        if (!ignore) {
          setLoadingSuggestions(false);
        }
      }
    };
    loadSuggestionUsers();
    return () => {
      ignore = true;
    };
  }, [openDialog, users]);

  const smartAutocompleteSx = {
    mb: 2,
    '& .MuiOutlinedInput-root': {
      borderRadius: 2,
      bgcolor: '#ffffff',
      '& fieldset': { borderColor: '#c7d6ea' },
      '&:hover fieldset': { borderColor: '#60a5fa' },
      '&.Mui-focused fieldset': { borderColor: '#2563eb' }
    }
  };

  const visibleUsers = useMemo(() => {
    const list = Array.isArray(users) ? [...users] : [];
    const normalizedSearch = normalizeSearchText(search).trim();
    const filteredList = normalizedSearch
      ? list.filter((user) => {
          const tableText = [
            user?.nombre,
            user?.email,
            user?.username,
            user?.dependencia,
            user?.cargo,
            user?.jefe_inmediato,
            getCompactRoleLabel(user?.role),
            user?.role,
            user?.estado
          ].filter(Boolean).map(normalizeSearchText).join(' ');
          return tableText.includes(normalizedSearch);
        })
      : list;

    return filteredList.sort((a, b) => {
      const roleA = getCompactRoleLabel(a?.role) || String(a?.role || '');
      const roleB = getCompactRoleLabel(b?.role) || String(b?.role || '');
      const roleCompare = roleA.localeCompare(roleB, 'es', { sensitivity: 'base' });
      if (roleCompare !== 0) return roleCompare;
      return String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es', { sensitivity: 'base' });
    });
  }, [normalizeSearchText, search, users]);

  const confirmUser = confirmUserAction.user || {};
  const confirmUserConfig = useMemo(() => {
    if (confirmUserAction.type === 'delete') {
      return {
        title: 'Eliminar usuario',
        eyebrow: 'Accion permanente',
        message: 'El registro se retirara definitivamente del sistema. Verifica que no sea requerido para trazabilidad o aprobaciones.',
        actionLabel: 'Eliminar usuario',
        tone: '#dc2626',
        softTone: '#fef2f2',
        borderTone: '#fecaca',
        icon: <DeleteIcon fontSize="small" />
      };
    }
    if (confirmUserAction.type === 'deactivate') {
      return {
        title: 'Inactivar usuario',
        eyebrow: 'Control de acceso',
        message: 'El usuario no podra iniciar sesion mientras permanezca inactivo, pero su historial se conserva.',
        actionLabel: 'Inactivar',
        tone: '#d97706',
        softTone: '#fffbeb',
        borderTone: '#fde68a',
        icon: <BlockIcon fontSize="small" />
      };
    }
    return {
      title: 'Reactivar usuario',
      eyebrow: 'Control de acceso',
      message: 'El usuario recuperara el acceso segun su rol, estado y permisos actuales.',
      actionLabel: 'Reactivar',
      tone: '#059669',
      softTone: '#ecfdf5',
      borderTone: '#a7f3d0',
      icon: <CheckCircleIcon fontSize="small" />
    };
  }, [confirmUserAction.type]);

  return (
    <Fade in={true}>
      <Box>
        {/* Header */}
        <Paper
          elevation={0}
          sx={{
            mb: 3,
            p: { xs: 2.5, sm: 3, md: 3.5 },
            borderRadius: { xs: 3, md: 3.5 },
            border: '1px solid #d7e3f5',
            background: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 40%, #be123c 100%)',
            color: 'white',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <Box sx={{ position: 'absolute', inset: 0, opacity: 0.25, background: 'radial-gradient(circle at 15% 10%, rgba(255,255,255,0.18), transparent 45%)' }} />
          <Box sx={{ position: 'absolute', right: -80, bottom: -80, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.12)' }} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 2, sm: 2.5 }} alignItems={{ sm: 'center' }} sx={{ position: 'relative', zIndex: 1 }}>
            <Box
              sx={{
                width: { xs: 64, md: 78 },
                height: { xs: 64, md: 78 },
                borderRadius: 2.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.45)',
                boxShadow: '0 8px 26px rgba(15, 23, 42, 0.35)'
              }}
            >
              <GroupIcon sx={{ fontSize: { xs: 30, md: 38 }, color: 'white' }} />
            </Box>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h4" sx={{ fontWeight: 900, mb: 0.8, letterSpacing: 0.2, fontSize: { xs: 24, sm: 28, md: 34 } }}>
                Gestión de Usuarios
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.9)', fontSize: { xs: 13, sm: 14, md: 16 } }}>
                Administra usuarios del sistema institucional (documento, correo, dependencia, cargo, jefe inmediato y rol)
              </Typography>
            </Box>
          </Stack>

        </Paper>

        {/* Panel principal: carga individual y cargue masivo */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 1.5, sm: 2, md: 2.2 },
            mb: 1.5,
            borderRadius: 2.5,
            border: '1px solid #bfdbfe',
            borderTop: '4px solid #2563eb',
            bgcolor: '#f8fbff'
          }}
        >
          <Stack spacing={1.6}>
            <Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="flex-end" sx={{ width: '100%' }}>
                  {currentUser?.role === ROLES.ADMINISTRADOR && (
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => setOpenClearConfirmDialog(true)}
                      sx={{
                        minWidth: { xs: '100%', sm: 190 },
                        borderRadius: 1.8,
                        py: 0.95,
                        textTransform: 'none',
                        fontWeight: 800,
                        borderWidth: 2,
                        '&:hover': { borderWidth: 2 }
                      }}
                    >
                      Vaciar base de datos
                    </Button>
                  )}
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenDialog('create')}
                    sx={{
                      minWidth: { xs: '100%', sm: 170 },
                      borderRadius: 1.8,
                      py: 0.95,
                      textTransform: 'none',
                      fontWeight: 800,
                      background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                      boxShadow: '0 8px 20px rgba(37,99,235,0.25)'
                    }}
                  >
                    Crear usuario
                  </Button>
              </Stack>
            </Box>

            <Divider sx={{ borderColor: '#dbeafe' }} />

            <Box>
              <Typography
                variant="overline"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  pl: 1.2,
                  mb: 1.5,
                  borderLeft: '4px solid #2563eb',
                  color: '#1e3a8a',
                  fontWeight: 900,
                  letterSpacing: 1
                }}
              >
                Cargue masivo por archivo Excel
              </Typography>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: '1fr 28px 1fr 28px 1fr' },
                  gap: { xs: 1.2, md: 1 },
                  alignItems: 'stretch'
                }}
              >
                <Box sx={{ p: 1.4, borderRadius: 2, border: '1px solid #bfdbfe', bgcolor: '#eff6ff' }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Chip label="1" size="small" sx={{ bgcolor: '#2563eb', color: '#fff', fontWeight: 900 }} />
                    <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 14 }}>Descargar plantilla</Typography>
                  </Stack>
                  <Typography sx={{ color: '#475569', fontSize: 12.5, mb: 1.2 }}>
                    Usa el formato oficial con los campos de usuario.
                  </Typography>
                  <Button fullWidth variant="outlined" startIcon={<DownloadIcon />} onClick={handleDownloadTemplate} sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 800, bgcolor: '#fff' }}>
                    Descargar plantilla
                  </Button>
                </Box>

                <Box sx={{ display: { xs: 'none', md: 'grid' }, placeItems: 'center', color: '#94a3b8' }}>
                  <ArrowForwardIcon fontSize="small" />
                </Box>

                <Box sx={{ p: 1.4, borderRadius: 2, border: uploadFile ? '1px solid #86efac' : '1px solid #d7e3f5', bgcolor: uploadFile ? '#f0fdf4' : '#ffffff' }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Chip label="2" size="small" sx={{ bgcolor: uploadFile ? '#10b981' : '#94a3b8', color: '#fff', fontWeight: 900 }} />
                    <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 14 }}>Adjuntar archivo</Typography>
                  </Stack>
                  <Typography sx={{ color: '#475569', fontSize: 12.5, mb: 1.2, minHeight: 19 }}>
                    {uploadFile ? uploadFile.name : 'Selecciona el Excel diligenciado.'}
                  </Typography>
                  <Button fullWidth variant="outlined" component="label" startIcon={<UploadIcon />} sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 800, bgcolor: '#fff' }}>
                    Seleccionar archivo
                    <input
                      key={uploadInputKey}
                      type="file"
                      hidden
                      accept=".xlsx,.xls"
                      onChange={(e) => {
                        setUploadFile(e.target.files[0] || null);
                        setBulkImportResult(null);
                        setBulkErrorFile(null);
                        setBulkWarningFile(null);
                      }}
                    />
                  </Button>
                </Box>

                <Box sx={{ display: { xs: 'none', md: 'grid' }, placeItems: 'center', color: '#94a3b8' }}>
                  <ArrowForwardIcon fontSize="small" />
                </Box>

                <Box sx={{ p: 1.4, borderRadius: 2, border: uploadFile ? '1px solid #bfdbfe' : '1px solid #d7e3f5', bgcolor: uploadFile ? '#ffffff' : '#f8fafc' }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Chip label="3" size="small" sx={{ bgcolor: uploadFile ? '#2563eb' : '#94a3b8', color: '#fff', fontWeight: 900 }} />
                    <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 14 }}>Cargar al sistema</Typography>
                  </Stack>
                  <Typography sx={{ color: '#475569', fontSize: 12.5, mb: 1, fontWeight: 700 }}>
                    Tipo de operación:
                  </Typography>
                  <FormControl component="fieldset" sx={{ mb: 1.5, display: 'block' }}>
                    <RadioGroup
                      value={operationType}
                      onChange={(e) => setOperationType(e.target.value)}
                      sx={{
                        gap: 0.8,
                        '& .MuiFormControlLabel-root': {
                          margin: 0,
                          padding: '5px 10px',
                          borderRadius: 2,
                          border: '1px solid #e2e8f0',
                          width: '100%',
                          transition: 'all 0.2s',
                          bgcolor: '#fff',
                          mb: 0.6,
                          '&:hover': {
                            backgroundColor: '#f8fafc',
                            borderColor: '#cbd5e1'
                          },
                          '&.Mui-checked': {
                            borderColor: '#2563eb',
                            backgroundColor: '#f0f6ff'
                          }
                        },
                        '& .MuiFormControlLabel-label': {
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: '#334155'
                        }
                      }}
                    >
                      <FormControlLabel
                        value="sync"
                        control={<Radio size="small" sx={{ p: 0.5 }} />}
                        label="Sincronizar y actualizar registros"
                      />
                      <FormControlLabel
                        value="replace"
                        control={<Radio size="small" sx={{ p: 0.5 }} />}
                        label="Reemplazo total de información"
                      />
                    </RadioGroup>
                  </FormControl>
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={sendBulkEmails}
                        onChange={(event) => setSendBulkEmails(event.target.checked)}
                      />
                    }
                    label="Enviar correos de bienvenida (Solo nuevos)"
                    sx={{
                      mb: 1.5,
                      mx: 0,
                      display: 'flex',
                      '& .MuiFormControlLabel-label': {
                        fontSize: 12.5,
                        color: '#475569',
                        fontWeight: 600
                      }
                    }}
                  />
                  <Button
                    fullWidth
                    variant="contained"
                    disabled={!uploadFile || uploading}
                    onClick={handleBulkUploadProfessional}
                    sx={{
                      borderRadius: 1.5,
                      textTransform: 'none',
                      fontWeight: 800,
                      py: 1,
                      bgcolor: '#2563eb',
                      boxShadow: '0 4px 12px rgba(37,99,235,0.2)',
                      '&:hover': { bgcolor: '#1d4ed8' },
                      '&.Mui-disabled': { bgcolor: '#bfdbfe', color: '#1e3a8a' }
                    }}
                  >
                    {uploading ? <CircularProgress size={20} sx={{ color: '#1d4ed8' }} /> : 'Importar usuarios'}
                  </Button>
                </Box>
              </Box>

              <Box
                sx={{
                  mt: 1.2,
                  p: { xs: 1.2, sm: 1.4 },
                  borderRadius: 2,
                  border: '1px solid #bfdbfe',
                  borderLeft: '4px solid #2563eb',
                  background: 'linear-gradient(135deg, #f8fbff 0%, #ffffff 100%)',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.08)'
                }}
              >
                <Stack direction="row" spacing={0.9} alignItems="center" sx={{ mb: 0.9 }}>
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: 1.4,
                      display: 'grid',
                      placeItems: 'center',
                      color: '#ffffff',
                      bgcolor: '#2563eb',
                      boxShadow: '0 4px 10px rgba(37, 99, 235, 0.18)'
                    }}
                  >
                    <SearchIcon sx={{ fontSize: 17 }} />
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#0f2f7a', lineHeight: 1.1 }}>
                      Buscar usuarios
                    </Typography>
                    <Typography sx={{ color: '#52657f', fontSize: 11.5, fontWeight: 600, lineHeight: 1.25 }}>
                      Filtra por nombre, documento, correo, dependencia, cargo, jefe, rol o estado
                    </Typography>
                  </Box>
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="stretch">
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Escribe una palabra para filtrar la tabla de usuarios"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    InputProps={{
                      startAdornment: <SearchIcon sx={{ mr: 1, color: '#2563eb' }} />
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 1.7,
                        bgcolor: 'white',
                        boxShadow: 'inset 0 0 0 1px rgba(37, 99, 235, 0.03)',
                        '& input': {
                          fontWeight: 600,
                          color: '#10213f'
                        },
                        '& input::placeholder': {
                          color: '#64748b',
                          opacity: 0.82,
                          fontWeight: 500
                        },
                        '& fieldset': { borderColor: '#7fb3ff' },
                        '&:hover fieldset': { borderColor: '#60a5fa' },
                        '&.Mui-focused': {
                          boxShadow: '0 0 0 2px rgba(37, 99, 235, 0.08)'
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#1d4ed8'
                        }
                      }
                    }}
                  />
                  <Button
                    variant="outlined"
                    startIcon={<ClearIcon />}
                    onClick={handleClearTools}
                    sx={{
                      minWidth: { xs: '100%', sm: 150 },
                      borderRadius: 1.7,
                      px: 2.2,
                      textTransform: 'none',
                      fontWeight: 900,
                      color: '#1d4ed8',
                      borderColor: '#93c5fd',
                      bgcolor: '#ffffff',
                      boxShadow: '0 3px 10px rgba(37, 99, 235, 0.08)',
                      '&:hover': {
                        borderColor: '#2563eb',
                        bgcolor: '#eff6ff'
                      }
                    }}
                  >
                    Limpiar
                  </Button>
                </Stack>
              </Box>
            </Box>
          </Stack>

          {bulkImportResult && (
            <Alert
              severity={bulkImportResult.errores?.length ? 'warning' : 'success'}
              sx={{ mt: 1.25, borderRadius: 2, alignItems: 'center' }}
              action={
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  {bulkErrorFile && (
                    <Button
                      size="small"
                      variant="contained"
                      color="warning"
                      onClick={() => downloadBase64Excel(bulkErrorFile, 'errores_carga_usuarios.xlsx')}
                    >
                      Descargar errores
                    </Button>
                  )}
                  {bulkWarningFile && (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => downloadBase64Excel(bulkWarningFile, 'advertencias_carga_usuarios.xlsx')}
                    >
                      Advertencias
                    </Button>
                  )}
                </Stack>
              }
            >
              Sincronizados: {(bulkImportResult.importados || 0) + (bulkImportResult.actualizados || 0)}
              {' | '}Nuevos: {bulkImportResult.importados || 0}
{' | '}Actualizados: {bulkImportResult.actualizados || 0}
              {bulkImportResult.eliminados > 0 ? ` | Eliminados: ${bulkImportResult.eliminados}` : ''}
              {' | '}Correos: {bulkImportResult.correosEnviados || 0}
              {bulkImportResult.correosOmitidos ? ` | Correos omitidos: ${bulkImportResult.correosOmitidos}` : ''}
              {' | '}Errores: {bulkImportResult.errores?.length || 0}
            </Alert>
          )}
        </Paper>

        {/* Tabla de usuarios */}
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <DependenciaFilterPanel
            label="Filtrar por Dependencia"
            options={dependenciaOptions.filter(d => d !== 'Todas')}
            value={filterDependencia}
            onChange={setFilterDependencia}
            placeholder="Buscar dependencia..."
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center" sx={{ width: { xs: '100%', md: 'auto' } }}>
            <Button
              size="medium"
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadPendingNotifications}
              sx={{
                borderRadius: 1.5,
                textTransform: 'none',
                fontWeight: 800,
                fontSize: 13,
                px: 2,
                py: 0.8,
                bgcolor: '#d97706',
                boxShadow: '0 4px 12px rgba(217, 119, 6, 0.2)',
                '&:hover': { bgcolor: '#b45309' },
                minWidth: { xs: '100%', sm: 'auto' }
              }}
            >
              Descargar sin notificar
            </Button>

            <Button
              size="medium"
              variant="contained"
              startIcon={<WarningIcon />}
              onClick={handleSendPendingNotifications}
              sx={{
                borderRadius: 1.5,
                textTransform: 'none',
                fontWeight: 800,
                fontSize: 13,
                px: 2,
                py: 0.8,
                bgcolor: '#2563eb',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
                '&:hover': { bgcolor: '#1d4ed8' },
                minWidth: { xs: '100%', sm: 'auto' }
              }}
            >
              Enviar a pendientes
            </Button>

            <Button
              size="medium"
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={handleExportUsuarios}
              sx={{
                borderRadius: 1.5,
                textTransform: 'none',
                fontWeight: 800,
                fontSize: 13,
                px: 2,
                py: 0.8,
                bgcolor: '#059669',
                boxShadow: '0 4px 12px rgba(5, 150, 105, 0.2)',
                '&:hover': { bgcolor: '#047857' },
                minWidth: { xs: '100%', sm: 'auto' }
              }}
            >
              Exportar a Excel
            </Button>
          </Stack>
        </Stack>

        <Paper elevation={0} sx={{ border: '1px solid #cbd5e1', borderRadius: 1.5, overflow: 'hidden', boxShadow: '0 6px 16px rgba(15,23,42,0.05)' }}>
          <TableContainer sx={{ bgcolor: '#ffffff', borderRadius: 0 }}>
            <Table
              size="small"
              sx={{
                tableLayout: 'fixed',
                width: '100%',
                minWidth: { xs: 860, sm: 920, md: 980, lg: 1040 },
                '& .MuiTableCell-root': {
                  verticalAlign: 'top',
                  borderRight: '1px solid #edf2f7'
                },
                '& .MuiTableCell-root:last-of-type': {
                  borderRight: 0
                }
              }}
            >
              <TableHead>
                <TableRow
                  sx={{
                    background: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 70%, #1e40af 100%)',
                    '& .MuiTableCell-root': {
                      color: 'white',
                      fontWeight: 800,
                      fontSize: 11,
                      borderBottom: '2px solid #1e3a8a',
                      textTransform: 'uppercase',
                      letterSpacing: 0.3,
                      py: 0.85,
                      px: { xs: 0.45, sm: 0.55, md: 0.65 },
                      lineHeight: 1.15,
                      borderRadius: 0,
                      borderRight: '1px solid rgba(255,255,255,0.18)'
                    },
                    '& .MuiTableCell-root:last-of-type': {
                      borderRight: 0
                    }
                  }}
                >
                  <TableCell sx={{ width: '13%' }}>Nombre</TableCell>
                  <TableCell sx={{ width: '16%' }}>Email</TableCell>
                  <TableCell align="center" sx={{ width: '8%' }}>Documento</TableCell>
                  <TableCell sx={{ width: '11%' }}>Dependencia</TableCell>
                  <TableCell sx={{ width: '13%' }}>Cargo</TableCell>
                  <TableCell sx={{ width: '13%' }}>Jefe inmediato</TableCell>
                  <TableCell align="center" sx={{ width: '7%' }}>Rol</TableCell>
                  <TableCell align="center" sx={{ width: '7%' }}>Estado</TableCell>
                  <TableCell align="center" sx={{ width: '12%' }}>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 8 }}>
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 8 }}>
                      <Typography color="text.secondary">No hay usuarios registrados</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleUsers.map((user, index) => {
                    const isDeleting = deletingUserIds.has(user.id);
                    const isSelf = isCurrentUserRow(user);
                    return (
                    <TableRow
                      key={user.id}
                      hover
                      sx={{
                        bgcolor: index % 2 === 0 ? '#ffffff' : '#f8fafc',
                        '&:hover': { bgcolor: '#eef4ff' },
                        '& .MuiTableCell-root': {
                          borderBottom: '1px solid #e2e8f0',
                          verticalAlign: 'middle',
                          borderRight: '1px solid #eef2f7'
                        },
                        '& .MuiTableCell-root:last-of-type': {
                          borderRight: 0
                        }
                      }}
                    >
                      <TableCell sx={{ ...wrapCellSx, fontWeight: 700, color: '#0f172a', textTransform: 'uppercase' }}>
                        <span className="cellText">{user.nombre}</span>
                      </TableCell>
                      <TableCell sx={{ ...wrapCellSx, color: '#1e293b', textTransform: 'none' }}>
                        <span className="cellText">{user.email}</span>
                      </TableCell>
                      <TableCell align="center" sx={{ ...wrapCellSx }}>
                        <span className="cellText" style={{ fontWeight: 700, color: '#0f172a' }}>{user.username}</span>
                      </TableCell>
                      <TableCell sx={wrapCellSx}>
                        <span className="cellText">{user.dependencia || '-'}</span>
                      </TableCell>
                      <TableCell sx={wrapCellSx}>
                        <span className="cellText">{user.cargo || '-'}</span>
                      </TableCell>
                      <TableCell sx={wrapCellSx}>
                        <span className="cellText">{user.jefe_inmediato || '-'}</span>
                      </TableCell>
                      <TableCell align="center" sx={{ ...wrapCellSx }}>
                        <Chip
                          label={getCompactRoleLabel(user.role)}
                          color={getRoleColor(user.role)}
                          size="small"
                          sx={roleChipSx}
                        />
                      </TableCell>
                      <TableCell align="center" sx={{ ...wrapCellSx }}>
                        <Chip
                          label={user.estado}
                          color={getEstadoColor(user.estado)}
                          size="small"
                          sx={statusChipSx}
                        />
                      </TableCell>
                      <TableCell align="center" sx={{ ...wrapCellSx }}>
                        <Stack direction="row" spacing={0.35} justifyContent="center" sx={{ flexWrap: 'nowrap' }}>
                          <Tooltip title="Editar">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenDialog('edit', user)}
                              disabled={isDeleting}
                              sx={{ width: 26, height: 26, color: '#3b82f6', bgcolor: '#eff6ff', '&:hover': { bgcolor: '#dbeafe' } }}
                            >
                              <EditIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                          {canManageModulePermissions && (
                            <Tooltip title="Permisos de módulos">
                              <IconButton
                                size="small"
                                onClick={() => handleOpenPermissionsDialog(user)}
                                disabled={isDeleting}
                                sx={{ width: 26, height: 26, color: '#0ea5e9', bgcolor: '#e0f2fe', '&:hover': { bgcolor: '#bae6fd' } }}
                              >
                                <SecurityIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title={isSelf && user.estado === 'activo' ? 'No puedes inactivar tu propio usuario' : (user.estado === 'activo' ? 'Inactivar' : 'Reactivar')}>
                            <IconButton
                              size="small"
                              onClick={() => handleToggleStatus(user)}
                              disabled={isDeleting || (isSelf && user.estado === 'activo')}
                              sx={{ width: 26, height: 26, color: user.estado === 'activo' ? '#f59e0b' : '#10b981', bgcolor: '#fef3c7', '&:hover': { bgcolor: '#fde68a' } }}
                            >
                              {user.estado === 'activo' ? <BlockIcon sx={{ fontSize: 16 }} /> : <CheckCircleIcon sx={{ fontSize: 16 }} />}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={isSelf ? 'No puedes eliminar tu propio usuario' : 'Eliminar Permanente'}>
                            <IconButton
                              size="small"
                              onClick={() => handleDelete(user)}
                              disabled={isDeleting || isSelf}
                              sx={{ width: 26, height: 26, color: '#ef4444', bgcolor: '#fee2e2', '&:hover': { bgcolor: '#fecaca' } }}
                            >
                              {isDeleting ? <CircularProgress size={14} color="inherit" /> : <DeleteIcon sx={{ fontSize: 16 }} />}
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={total}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(e, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            labelRowsPerPage="Filas por página:"
            sx={{ borderTop: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}
          />
        </Paper>

        <Dialog
          open={confirmUserAction.open}
          onClose={handleCloseConfirmUserAction}
          maxWidth="xs"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              overflow: 'hidden',
              boxShadow: '0 28px 80px rgba(15, 23, 42, 0.28)'
            }
          }}
        >
          <Box
            sx={{
              px: 3,
              py: 2.4,
              display: 'flex',
              alignItems: 'center',
              gap: 1.7,
              bgcolor: confirmUserConfig.softTone,
              borderBottom: `1px solid ${confirmUserConfig.borderTone}`
            }}
          >
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                color: '#fff',
                bgcolor: confirmUserConfig.tone,
                boxShadow: `0 10px 24px ${confirmUserConfig.tone}44`
              }}
            >
              {confirmUserConfig.icon}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 19, lineHeight: 1.15 }}>
                {confirmUserConfig.title}
              </Typography>
              <Typography sx={{ color: '#64748b', fontSize: 13, mt: 0.4 }}>
                {confirmUserConfig.eyebrow}
              </Typography>
            </Box>
          </Box>
          <DialogContent sx={{ p: 3 }}>
            <Typography sx={{ color: '#334155', fontSize: 14.5, lineHeight: 1.65, mb: 2 }}>
              {confirmUserConfig.message}
            </Typography>
            <Box
              sx={{
                p: 1.6,
                borderRadius: 2,
                border: '1px solid #dbe7f6',
                bgcolor: '#f8fbff',
                display: 'grid',
                gap: 0.7
              }}
            >
              <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 15 }}>
                {confirmUser.nombre || 'Usuario seleccionado'}
              </Typography>
              <Typography sx={{ color: '#475569', fontSize: 13 }}>
                {confirmUser.email || 'Sin correo registrado'}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 0.8, pt: 0.4 }}>
                <Chip size="small" label={confirmUser.username || 'Sin documento'} variant="outlined" />
                <Chip size="small" label={getCompactRoleLabel(confirmUser.role) || 'Sin rol'} />
                <Chip size="small" label={confirmUser.estado || 'Sin estado'} color={getEstadoColor(confirmUser.estado)} />
              </Stack>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5, pt: 0, gap: 1 }}>
            <Button onClick={handleCloseConfirmUserAction} disabled={confirmUserSubmitting} sx={{ fontWeight: 800 }}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              onClick={handleConfirmUserAction}
              disabled={confirmUserSubmitting}
              startIcon={confirmUserSubmitting ? <CircularProgress size={16} color="inherit" /> : confirmUserConfig.icon}
              sx={{
                fontWeight: 900,
                bgcolor: confirmUserConfig.tone,
                boxShadow: `0 12px 24px ${confirmUserConfig.tone}33`,
                '&:hover': { bgcolor: confirmUserConfig.tone, filter: 'brightness(0.92)' }
              }}
            >
              {confirmUserSubmitting ? 'Procesando...' : confirmUserConfig.actionLabel}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Dialog Confirmar Reemplazo Total */}
        <Dialog
          open={confirmReplaceOpen}
          onClose={() => setConfirmReplaceOpen(false)}
          maxWidth="xs"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              overflow: 'hidden',
              boxShadow: '0 28px 80px rgba(15, 23, 42, 0.28)'
            }
          }}
        >
          <Box
            sx={{
              px: 3,
              py: 2.4,
              display: 'flex',
              alignItems: 'center',
              gap: 1.7,
              bgcolor: '#fef2f2',
              borderBottom: '1px solid #fecaca'
            }}
          >
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                color: '#fff',
                bgcolor: '#dc2626',
                boxShadow: '0 10px 24px rgba(220, 38, 38, 0.27)'
              }}
            >
              <WarningIcon fontSize="small" />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 19, lineHeight: 1.15 }}>
                Confirmar Reemplazo Total
              </Typography>
              <Typography sx={{ color: '#64748b', fontSize: 13, mt: 0.4 }}>
                Carga Masiva de Usuarios
              </Typography>
            </Box>
          </Box>
          <DialogContent sx={{ p: 3 }}>
            <Typography sx={{ color: '#334155', fontSize: 14.5, lineHeight: 1.65, mb: 2 }}>
              ¿Está seguro de que desea realizar un reemplazo total de la información?
            </Typography>
            <Alert severity="error" icon={<WarningIcon />} sx={{ borderRadius: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                ¡Advertencia de Impacto Alto!
              </Typography>
              Esta acción eliminará de forma permanente a los usuarios que <strong>no estén incluidos</strong> en el archivo Excel y que su rol actual permita gestionar. Su propio usuario no se elimina.
            </Alert>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5, pt: 0, gap: 1 }}>
            <Button onClick={() => setConfirmReplaceOpen(false)} disabled={uploading} sx={{ fontWeight: 800 }}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              onClick={async () => {
                setConfirmReplaceOpen(false);
                await executeBulkUpload();
              }}
              disabled={uploading}
              startIcon={<WarningIcon />}
              sx={{
                fontWeight: 900,
                bgcolor: '#dc2626',
                boxShadow: '0 12px 24px rgba(220, 38, 38, 0.2)',
                '&:hover': { bgcolor: '#b91c1c' }
              }}
            >
              Confirmar Reemplazo
            </Button>
          </DialogActions>
        </Dialog>

        {/* Dialog Crear/Editar */}
        <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
          <DialogTitle>
            {dialogMode === 'create' ? 'Crear Nuevo Usuario' : 'Editar Usuario'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <Alert severity="info" sx={{ mb: 3 }}>
                El correo debe pertenecer al dominio @unicesmag.edu.co
              </Alert>
              <TextField
                fullWidth
                label="Número de documento"
                value={formData.username}
                onChange={(e) => {
                  const value = String(e.target.value || '').replace(/\D/g, '').slice(0, 15);
                  setFormData({ ...formData, username: value });
                  setFormErrors((prev) => ({ ...prev, username: '' }));
                }}
                sx={{ mb: 2 }}
                required
                error={Boolean(formErrors.username)}
                helperText={formErrors.username || 'Solo números (4 a 15 dígitos)'}
                inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 15 }}
                placeholder="Ej: 1085327166"
              />
              <TextField
                fullWidth
                label="Nombre Completo"
                value={formData.nombre}
                onChange={(e) => {
                  setFormData({ ...formData, nombre: e.target.value });
                  setFormErrors((prev) => ({ ...prev, nombre: '' }));
                }}
                sx={{ mb: 2 }}
                required
                error={Boolean(formErrors.nombre)}
                helperText={formErrors.nombre || 'Ej: Juan Camilo Benavides'}
              />
              <TextField
                fullWidth
                label="Correo Institucional"
                type="email"
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  setFormErrors((prev) => ({ ...prev, email: '' }));
                }}
                sx={{ mb: 2 }}
                required
                error={Boolean(formErrors.email)}
                helperText={formErrors.email || 'Debe terminar en @unicesmag.edu.co'}
                placeholder="usuario@unicesmag.edu.co"
              />
              <Autocomplete
                freeSolo
                autoHighlight
                options={dependenciaOptions}
                value={formData.dependencia || ''}
                inputValue={formData.dependencia || ''}
                loading={loadingSuggestions}
                loadingText="Cargando dependencias..."
                noOptionsText="Sin coincidencias, puedes escribir una nueva"
                onChange={(event, newValue) => setFormData({ ...formData, dependencia: newValue || '' })}
                onInputChange={(event, newInputValue) => setFormData({ ...formData, dependencia: newInputValue || '' })}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    fullWidth
                    label="Dependencia"
                    helperText="Elige una existente o escribe una nueva"
                    inputProps={{ ...params.inputProps, maxLength: 220 }}
                  />
                )}
                sx={smartAutocompleteSx}
              />
              <Autocomplete
                freeSolo
                autoHighlight
                options={cargoOptions}
                value={formData.cargo || ''}
                inputValue={formData.cargo || ''}
                loading={loadingSuggestions}
                loadingText="Cargando cargos..."
                noOptionsText="Sin coincidencias, puedes escribir uno nuevo"
                onChange={(event, newValue) => setFormData({ ...formData, cargo: newValue || '' })}
                onInputChange={(event, newInputValue) => setFormData({ ...formData, cargo: newInputValue || '' })}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    fullWidth
                    label="Cargo"
                    helperText="Elige un cargo existente o escribe uno nuevo"
                    inputProps={{ ...params.inputProps, maxLength: 220 }}
                  />
                )}
                sx={smartAutocompleteSx}
              />
              <Autocomplete
                freeSolo
                autoHighlight
                options={jefeInmediatoOptions}
                value={formData.jefe_inmediato || ''}
                inputValue={formData.jefe_inmediato || ''}
                loading={loadingSuggestions}
                loadingText="Cargando jefes..."
                noOptionsText="Sin coincidencias, puedes escribir un nuevo nombre"
                onChange={(event, newValue) => setFormData({ ...formData, jefe_inmediato: newValue || '' })}
                onInputChange={(event, newInputValue) => setFormData({ ...formData, jefe_inmediato: newInputValue || '' })}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    fullWidth
                    label="Jefe inmediato"
                    helperText="Elige un jefe registrado o escribe el nombre"
                    inputProps={{ ...params.inputProps, maxLength: 220 }}
                  />
                )}
                sx={smartAutocompleteSx}
              />
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Rol</InputLabel>
                <Select
                  value={formData.role}
                  label="Rol"
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  {allowedRolesForManager.map((roleOption) => (
                    <MenuItem key={roleOption} value={roleOption}>
                      {ROLE_LABELS[roleOption]}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancelar</Button>
            <Button variant="contained" onClick={handleSubmit}>
              {dialogMode === 'create' ? 'Crear' : 'Actualizar'}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={openPermissionsDialog} onClose={handleClosePermissionsDialog} maxWidth="md" fullWidth>
          <DialogTitle>
            Permisos de módulos {permissionsUser ? `- ${permissionsUser.nombre}` : ''}
          </DialogTitle>
          <DialogContent dividers>
            {permissionsLoading ? (
              <Box sx={{ py: 4, display: 'grid', placeItems: 'center' }}>
                <CircularProgress />
              </Box>
            ) : (
              <Stack spacing={2}>
                <Alert severity="info">
                  Asigna menú principal y módulos de Gestión de la Información. Esta sección se organiza en <strong>Gestión de Bases de Datos</strong> y <strong>Estadística Institucional</strong>.
                </Alert>
                <Alert severity="success" variant="outlined">
                  Si marcas un módulo interno, el sistema habilita automáticamente <strong>Gestión de la Información</strong> en el menú principal para conservar la navegación.
                </Alert>

                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography sx={{ fontWeight: 800, mb: 1, color: '#0f172a' }}>Menú principal</Typography>
                  <FormGroup>
                    <Grid container spacing={0.5}>
                      {MENU_PERMISSION_OPTIONS.map((item) => (
                        <Grid item xs={12} sm={6} md={4} key={`menu-${item.key}`}>
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={modulePermissionsForm.menuPermissions.includes(item.key)}
                                onChange={() => handleTogglePermission('menuPermissions', item.key)}
                                disabled={
                                  item.key === 'gestion_informacion' &&
                                  Array.isArray(modulePermissionsForm.allowedModules) &&
                                  (
                                    modulePermissionsForm.allowedModules.length > 0
                                    || modulePermissionsForm.allowedGestionProcesosDashboards.length > 0
                                    || modulePermissionsForm.allowedPoblacionalDashboards.length > 0
                                    || modulePermissionsForm.allowedSaberProDashboards.length > 0
                                    || modulePermissionsForm.allowedRecursoHumanoDashboards.length > 0
                                  )
                                }
                                size="small"
                              />
                            }
                            label={item.label}
                          />
                        </Grid>
                      ))}
                    </Grid>
                  </FormGroup>
                </Paper>

                <Divider />

                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography sx={{ fontWeight: 800, mb: 0.6, color: '#0f172a' }}>Modulos de Gestion de la Informacion</Typography>
                  <Typography variant="body2" sx={{ color: '#64748b', mb: 1.5 }}>
                    Selecciona el acceso general y los tableros estadisticos que el usuario podra ver.
                  </Typography>
                  <Stack spacing={1.4}>
                    {GI_MODULE_GROUPS.filter(group => {
                      if (group.title === 'Autoevaluacion') return modulePermissionsForm.menuPermissions?.includes('autoevaluacion') || modulePermissionsForm.allowedModules?.includes('autoevaluacion');
                      if (group.title === 'Seguridad Aplicativa') return modulePermissionsForm.allowedModules?.includes('seguridad_aplicativa');
                      return true;
                    }).map((group) => (
                      <Paper key={group.title} variant="outlined" sx={{ p: 1.4, borderRadius: 2, bgcolor: '#f8fbff' }}>
                        <Typography sx={{ fontWeight: 800, color: '#1e3a8a', mb: 0.8 }}>{group.title}</Typography>
                        <FormGroup>
                          <Grid container spacing={0.5}>
                            {group.options.map((item) => (
                              <Grid item xs={12} sm={6} md={4} key={`gi-${item.key}`}>
                                <FormControlLabel
                                  control={
                                    <Checkbox
                                      checked={modulePermissionsForm.allowedModules.includes(item.key) || modulePermissionsForm.menuPermissions?.includes(item.key)}
                                      onChange={() => {
                                        if (item.key === 'autoevaluacion.instrumentos.access') {
                                           // special handler maybe? or just allowedModules
                                           handleTogglePermission('allowedModules', item.key);
                                        } else {
                                          handleTogglePermission('allowedModules', item.key);
                                        }
                                      }}
                                      disabled={false}
                                      size="small"
                                    />
                                  }
                                  label={item.label}
                                />
                              </Grid>
                            ))}
                          </Grid>
                        </FormGroup>
                      </Paper>
                    ))}
                  </Stack>
                </Paper>

                { modulePermissionsForm.allowedModules.includes('poblacional') && (
                  <>
                    <Divider />

                    <Paper
                      variant="outlined"
                      sx={{ p: 2, borderRadius: 2 }}
                    >
                      <Typography sx={{ fontWeight: 800, mb: 0.6, color: '#0f172a' }}>Tableros internos de Poblacional</Typography>
                      <Typography variant="body2" sx={{ color: '#64748b', mb: 1.4 }}>
                        Activa los tableros poblacionales puntuales cuando el usuario no requiere toda la estadistica institucional.
                      </Typography>
                      <FormGroup>
                        <Grid container spacing={0.5}>
                          {POBLACIONAL_DASHBOARD_OPTIONS.map((item) => (
                            <Grid item xs={12} sm={6} md={4} key={`pobdash-${item.key}`}>
                              <FormControlLabel
                                control={(
                                  <Checkbox
                                    checked={modulePermissionsForm.allowedPoblacionalDashboards.includes(item.key)}
                                    onChange={() => handleTogglePermission('allowedPoblacionalDashboards', item.key)}
                                    size="small"
                                  />
                                )}
                                label={item.label}
                              />
                            </Grid>
                          ))}
                        </Grid>
                      </FormGroup>
                    </Paper>
                  </>
                )}

                { modulePermissionsForm.allowedModules.includes('gestion_procesos') && (
                  <>
                    <Divider />
                    <Paper
                      variant="outlined"
                      sx={{ p: 2, borderRadius: 2 }}
                    >
                      <Typography sx={{ fontWeight: 800, mb: 1, color: '#0f172a' }}>Módulos internos de Gestión por Procesos</Typography>
                      <FormGroup>
                        <Grid container spacing={0.5}>
                          {GESTION_PROCESOS_DASHBOARD_OPTIONS.map((item) => (
                            <Grid item xs={12} sm={6} md={6} key={`gpdash-${item.key}`}>
                              <FormControlLabel
                                control={(
                                  <Checkbox
                                    checked={modulePermissionsForm.allowedGestionProcesosDashboards.includes(item.key)}
                                    onChange={() => handleTogglePermission('allowedGestionProcesosDashboards', item.key)}
                                    size="small"
                                  />
                                )}
                                label={item.label}
                              />
                            </Grid>
                          ))}
                        </Grid>
                      </FormGroup>
                    </Paper>
                  </>
                )}

                { modulePermissionsForm.allowedModules.includes('saber_pro') && (
                  <>
                    <Divider />

                    <Paper
                      variant="outlined"
                      sx={{ p: 2, borderRadius: 2 }}
                    >
                      <Typography sx={{ fontWeight: 800, mb: 0.6, color: '#0f172a' }}>Permisos modulares de Saber Pro</Typography>
                      <Typography variant="body2" sx={{ color: '#64748b', mb: 1.6 }}>
                        Activa solo los bloques que necesite el usuario: consulta y validación, resultados individuales, agregados o valor agregado.
                      </Typography>
                      <Stack spacing={1.5}>
                        {SABER_PRO_PERMISSION_GROUPS.map((group) => (
                          <Paper key={group.title} variant="outlined" sx={{ p: 1.4, borderRadius: 2, bgcolor: '#f8fbff' }}>
                            <Typography sx={{ fontWeight: 800, color: '#1e3a8a', mb: 0.8 }}>{group.title}</Typography>
                            <FormGroup>
                              <Grid container spacing={0.5}>
                                {group.options.map((item) => (
                                  <Grid item xs={12} sm={6} md={4} key={`sp-${item.key}`}>
                                    <FormControlLabel
                                      control={(
                                        <Checkbox
                                          checked={modulePermissionsForm.allowedSaberProDashboards.includes(item.key)}
                                          onChange={() => handleTogglePermission('allowedSaberProDashboards', item.key)}
                                          size="small"
                                        />
                                      )}
                                      label={item.label}
                                    />
                                  </Grid>
                                ))}
                              </Grid>
                            </FormGroup>
                          </Paper>
                        ))}
                      </Stack>
                    </Paper>
                  </>
                )}

                { modulePermissionsForm.allowedModules.includes('recurso_humano') && (
                  <>
                    <Divider />

                    <Paper
                      variant="outlined"
                      sx={{ p: 2, borderRadius: 2 }}
                    >
                      <Typography sx={{ fontWeight: 800, mb: 0.6, color: '#0f172a' }}>Permisos modulares de Gestión del Talento Humano</Typography>
                      <Typography variant="body2" sx={{ color: '#64748b', mb: 1.6 }}>
                        Activa los sub-módulos para permitir el acceso a Profesores, Administrativos o Seguimiento.
                      </Typography>
                      <Stack spacing={1.5}>
                        {RECURSO_HUMANO_PERMISSION_GROUPS.map((group) => (
                          <Paper key={group.title} variant="outlined" sx={{ p: 1.4, borderRadius: 2, bgcolor: '#f8fbff' }}>
                            <Typography sx={{ fontWeight: 800, color: '#1e3a8a', mb: 0.8 }}>{group.title}</Typography>
                            <FormGroup>
                              <Grid container spacing={0.5}>
                                {group.options.map((item) => (
                                  <Grid item xs={12} sm={6} md={4} key={`rh-${item.key}`}>
                                    <FormControlLabel
                                      control={(
                                        <Checkbox
                                          checked={modulePermissionsForm.allowedRecursoHumanoDashboards?.includes(item.key) || false}
                                          onChange={() => handleTogglePermission('allowedRecursoHumanoDashboards', item.key)}
                                          size="small"
                                        />
                                      )}
                                      label={item.label}
                                    />
                                  </Grid>
                                ))}
                              </Grid>
                            </FormGroup>
                          </Paper>
                        ))}
                      </Stack>
                  </Paper>
                  </>
                )}

                { modulePermissionsForm.allowedModules.includes('infraestructura_fisica') && (
                  <>
                    <Divider />

                    <Paper
                      variant="outlined"
                      sx={{ p: 2, borderRadius: 2 }}
                    >
                      <Typography sx={{ fontWeight: 800, mb: 1, color: '#0f172a' }}>Tableros internos de Infraestructura Física</Typography>
                      <Typography variant="body2" sx={{ color: '#64748b', mb: 1.4 }}>
                        Activa los tableros y permisos de infraestructura física puntuales.
                      </Typography>
                      <FormGroup>
                        <Grid container spacing={0.5}>
                          {INFRAESTRUCTURA_FISICA_DASHBOARD_OPTIONS.map((item) => (
                            <Grid item xs={12} sm={6} md={4} key={`infdash-${item.key}`}>
                              <FormControlLabel
                                control={(
                                  <Checkbox
                                    checked={modulePermissionsForm.allowedInfraestructuraFisicaDashboards?.includes(item.key) || false}
                                    onChange={() => handleTogglePermission('allowedInfraestructuraFisicaDashboards', item.key)}
                                    size="small"
                                  />
                                )}
                                label={item.label}
                              />
                            </Grid>
                          ))}
                        </Grid>
                      </FormGroup>
                    </Paper>
                  </>
                )}

                { modulePermissionsForm.allowedModules.includes('internacionalizacion') && (
                  <>
                    <Divider />

                    <Paper
                      variant="outlined"
                      sx={{ p: 2, borderRadius: 2 }}
                    >
                      <Typography sx={{ fontWeight: 800, mb: 1, color: '#0f172a' }}>Tableros internos de Internacionalización</Typography>
                      <Typography variant="body2" sx={{ color: '#64748b', mb: 1.4 }}>
                        Activa los tableros y permisos de internacionalización puntuales.
                      </Typography>
                      <FormGroup>
                        <Grid container spacing={0.5}>
                          {INTERNACIONALIZACION_DASHBOARD_OPTIONS.map((item) => (
                            <Grid item xs={12} sm={6} md={4} key={`interdash-${item.key}`}>
                              <FormControlLabel
                                control={(
                                  <Checkbox
                                    checked={modulePermissionsForm.allowedInternacionalizacionDashboards?.includes(item.key) || false}
                                    onChange={() => handleTogglePermission('allowedInternacionalizacionDashboards', item.key)}
                                    size="small"
                                  />
                                )}
                                label={item.label}
                              />
                            </Grid>
                          ))}
                        </Grid>
                      </FormGroup>
                    </Paper>
                  </>
                )}

                { modulePermissionsForm.allowedModules.includes('plan_accion') && (
                  <>
                    <Divider />

                    <Paper
                      variant="outlined"
                      sx={{ p: 2, borderRadius: 2 }}
                    >
                      <Typography sx={{ fontWeight: 800, mb: 1, color: '#0f172a' }}>Tableros internos de Plan de Acción</Typography>
                      <Typography variant="body2" sx={{ color: '#64748b', mb: 1.4 }}>
                        Activa los tableros y permisos de Plan de Acción puntuales.
                      </Typography>
                      <FormGroup>
                        <Grid container spacing={0.5}>
                          {PLAN_ACCION_DASHBOARD_OPTIONS.map((item) => (
                            <Grid item xs={12} sm={6} md={4} key={`plandash-${item.key}`}>
                              <FormControlLabel
                                control={(
                                  <Checkbox
                                    checked={modulePermissionsForm.allowedPlanAccionDashboards?.includes(item.key) || false}
                                    onChange={() => handleTogglePermission('allowedPlanAccionDashboards', item.key)}
                                    size="small"
                                  />
                                )}
                                label={item.label}
                              />
                            </Grid>
                          ))}
                        </Grid>
                      </FormGroup>
                    </Paper>
                  </>
                )}
              </Stack>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClosePermissionsDialog} disabled={permissionsSaving}>Cancelar</Button>
            <Button variant="contained" onClick={handleSavePermissions} disabled={permissionsLoading || permissionsSaving}>
              {permissionsSaving ? 'Guardando...' : 'Guardar permisos'}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog 
          open={openClearConfirmDialog} 
          onClose={() => {
            if (!clearSubmitting) {
              setOpenClearConfirmDialog(false);
              setClearConfirmText('');
            }
          }} 
          maxWidth="xs" 
          fullWidth
        >
          <DialogTitle sx={{ color: '#ef4444', fontWeight: 900 }}>
            ⚠ ATENCIÓN: Acción Peligrosa
          </DialogTitle>
          <DialogContent dividers>
            <Typography variant="body2" sx={{ color: '#334155', mb: 2, lineHeight: 1.6 }}>
              Estás a punto de <strong>eliminar todos los usuarios</strong> registrados en el sistema. 
              Esta acción es irreversible y limpiará por completo la base de datos de usuarios.
            </Typography>
            <Typography variant="body2" sx={{ color: '#b91c1c', mb: 2, fontWeight: 700 }}>
              Nota de seguridad: Tu propio usuario activo y las cuentas de administrador del sistema se conservarán para evitar bloqueos.
            </Typography>
            <Typography variant="body2" sx={{ color: '#475569', mb: 1, fontWeight: 600 }}>
              Para confirmar, escribe la palabra <strong>ELIMINAR</strong> a continuación:
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="Escribe ELIMINAR"
              value={clearConfirmText}
              onChange={(e) => setClearConfirmText(e.target.value)}
              disabled={clearSubmitting}
              inputProps={{ style: { textTransform: 'uppercase', fontWeight: 800 } }}
            />
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={() => {
                setOpenClearConfirmDialog(false);
                setClearConfirmText('');
              }} 
              disabled={clearSubmitting}
            >
              Cancelar
            </Button>
            <Button 
              variant="contained" 
              color="error" 
              onClick={handleClearAllUsers} 
              disabled={clearSubmitting || clearConfirmText !== 'ELIMINAR'}
              startIcon={clearSubmitting ? <CircularProgress size={18} color="inherit" /> : null}
            >
              {clearSubmitting ? 'Eliminando...' : 'Sí, eliminar todo'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Fade>
  );
}

export default GestionUsuarios;
