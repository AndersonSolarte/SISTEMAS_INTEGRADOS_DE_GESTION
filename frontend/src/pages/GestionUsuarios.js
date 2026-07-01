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
    { key: 'recurso_humano', label: 'Recurso Humano / Gestion Humana', group: 'Tableros estadisticos' },
    { key: 'seguimiento_reportes_rrhh', label: 'Seguimiento a reportes (RRHH)', group: 'Tableros estadisticos' },
    { key: 'saber_pro', label: 'Saber Pro', group: 'Tableros estadisticos' },
    { key: 'gestion_procesos', label: 'Gestion por Procesos', group: 'Tableros estadisticos' },
    { key: 'plan_accion', label: 'Plan de Accion', group: 'Tableros estadisticos' },
    { key: 'autoevaluacion', label: 'Autoevaluacion', group: 'Tableros estadisticos' },
    { key: 'registros_calificados_acreditacion', label: 'Registros Calificados y Acreditacion', group: 'Tableros estadisticos' },
    { key: 'infraestructura_fisica', label: 'Infraestructura Fisica', group: 'Tableros estadisticos' },
    { key: 'autoevaluacion.instrumentos.access', label: 'Autoevaluacion - Gestion de Instrumentos', group: 'Permisos especializados' },
    { key: 'infraestructura_fisica.gestionar', label: 'Infraestructura Fisica - CRUD y Administracion de Bases de Datos', group: 'Permisos especializados' },
    { key: 'infraestructura_fisica.ver', label: 'Infraestructura Fisica - Visualizar Estadisticas, Graficos y KPIs', group: 'Permisos especializados' },
    { key: 'seguridad_aplicativa.ver', label: 'Seguridad Aplicativa - Ver modulo', group: 'Seguridad Aplicativa' },
    { key: 'seguridad_aplicativa.escanear', label: 'Seguridad Aplicativa - Ejecutar escaneo', group: 'Seguridad Aplicativa' },
    { key: 'seguridad_aplicativa.ver_hallazgos', label: 'Seguridad Aplicativa - Ver hallazgos', group: 'Seguridad Aplicativa' },
    { key: 'seguridad_aplicativa.gestionar_hallazgos', label: 'Seguridad Aplicativa - Gestionar hallazgos', group: 'Seguridad Aplicativa' },
    { key: 'seguridad_aplicativa.analizar_remediacion', label: 'Seguridad Aplicativa - Analizar remediacion', group: 'Seguridad Aplicativa' },
    { key: 'seguridad_aplicativa.exportar', label: 'Seguridad Aplicativa - Exportar', group: 'Seguridad Aplicativa' },
    { key: 'seguridad_aplicativa.configurar', label: 'Seguridad Aplicativa - Configurar', group: 'Seguridad Aplicativa' }
  ];
  const GI_MODULE_GROUPS = ['Acceso general', 'Tableros estadisticos', 'Permisos especializados', 'Seguridad Aplicativa']
    .map((title) => ({
      title,
      options: GI_MODULE_OPTIONS.filter((item) => item.group === title)
    }));
  const GESTION_PROCESOS_DASHBOARD_OPTIONS = [
    { key: 'estadistica_documental', label: 'Estadística Documental' }
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
    allowedRecursoHumanoDashboards: []
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
        ROLES.CONSULTA
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

    if (currentUser?.role === ROLES.GESTION_PROCESOS) {
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
                    {GI_MODULE_GROUPS.map((group) => (
                      <Paper key={group.title} variant="outlined" sx={{ p: 1.4, borderRadius: 2, bgcolor: '#f8fbff' }}>
                        <Typography sx={{ fontWeight: 800, color: '#1e3a8a', mb: 0.8 }}>{group.title}</Typography>
                        <FormGroup>
                          <Grid container spacing={0.5}>
                            {group.options.map((item) => (
                              <Grid item xs={12} sm={6} md={4} key={`gi-${item.key}`}>
                                <FormControlLabel
                                  control={
                                    <Checkbox
                                      checked={modulePermissionsForm.allowedModules.includes(item.key)}
                                      onChange={() => handleTogglePermission('allowedModules', item.key)}
                                      disabled={
                                        item.key === 'gestion_procesos' &&
                                        Array.isArray(modulePermissionsForm.allowedGestionProcesosDashboards) &&
                                        modulePermissionsForm.allowedGestionProcesosDashboards.length > 0
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
                    ))}
                  </Stack>
                </Paper>

                <Divider />

                <Paper
                  variant="outlined"
                  sx={{ p: 2, borderRadius: 2, opacity: (modulePermissionsForm.allowedModules.includes('estadistica_institucional') || modulePermissionsForm.allowedModules.includes('poblacional')) ? 1 : 0.55 }}
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
                                disabled={!(modulePermissionsForm.allowedModules.includes('estadistica_institucional') || modulePermissionsForm.allowedModules.includes('poblacional'))}
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

                <Divider />
                <Paper
                  variant="outlined"
                  sx={{ p: 2, borderRadius: 2, opacity: (modulePermissionsForm.allowedModules.includes('estadistica_institucional') || modulePermissionsForm.allowedModules.includes('gestion_procesos')) ? 1 : 0.55 }}
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
                                disabled={!(modulePermissionsForm.allowedModules.includes('estadistica_institucional') || modulePermissionsForm.allowedModules.includes('gestion_procesos'))}
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

                <Divider />

                <Paper
                  variant="outlined"
                  sx={{ p: 2, borderRadius: 2, opacity: (modulePermissionsForm.allowedModules.includes('estadistica_institucional') || modulePermissionsForm.allowedModules.includes('saber_pro')) ? 1 : 0.55 }}
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
                                      disabled={!(modulePermissionsForm.allowedModules.includes('estadistica_institucional') || modulePermissionsForm.allowedModules.includes('saber_pro'))}
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
      </Box>
    </Fade>
  );
}

export default GestionUsuarios;
