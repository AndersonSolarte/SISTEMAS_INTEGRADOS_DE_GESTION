import React, { useState, useEffect, useMemo, useCallback } from 'react';import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, IconButton, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Select, MenuItem, FormControl, InputLabel,
  Chip, Grid, Alert, CircularProgress, Fade, FormGroup, FormControlLabel, Checkbox, Divider
  , Stack
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Upload as UploadIcon,
  Download as DownloadIcon, Search as SearchIcon, Clear as ClearIcon,
  Block as BlockIcon, CheckCircle as CheckCircleIcon,
  GroupOutlined as GroupIcon, Security as SecurityIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import userService from '../services/userService';
import { ROLES, ROLE_LABELS } from '../constants/roles';
import { useAuth } from '../context/AuthContext';

function GestionUsuarios() {
  const MENU_PERMISSION_OPTIONS = [
    { key: 'dashboard', label: 'Inicio' },
    { key: 'gestion_informacion', label: 'Gestión de la Información' },
    { key: 'gestion_documentos', label: 'Gestión individual de documentos' },
    { key: 'buscar_documentos', label: 'Consulta de documentos' },
    { key: 'planeacion_estrategica', label: 'Planeación Estratégica' },
    { key: 'planeacion_efectividad', label: 'Planeación y Efectividad' },
    { key: 'autoevaluacion', label: 'Autoevaluación' },
    { key: 'aseguramiento_calidad', label: 'Administración del Sistema Documental' },
    { key: 'gestion_usuarios', label: 'Gestión de Usuarios' }
  ];
  const GI_MODULE_OPTIONS = [
    { key: 'gestion_bases_datos', label: 'Gestión de Bases de Datos' },
    { key: 'estadistica_institucional', label: 'Estadística Institucional' }
  ];
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
    { key: 'poblacional_saber_pro', label: 'Saber Pro (interno)' }
  ];

  const SABER_PRO_PERMISSION_GROUPS = [
    {
      title: 'Consulta y validacion',
      options: [
        { key: 'saber_pro_consulta_individual', label: 'Consulta individual' },
        { key: 'saber_pro_validacion_masiva', label: 'Validacion masiva' }
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
        { key: 'saber_pro_agregados_competencias_especificas', label: 'Agregados competencias especificas' },
        { key: 'saber_pro_agregados_competencias_genericas', label: 'Agregados competencias genericas' },
        { key: 'saber_pro_agregados_comparativo_general', label: 'Comparativo Saber Pro' },
        { key: 'saber_pro_agregados_comparativo_especificas', label: 'Comparativo especificas' }
      ]
    },
    {
      title: 'Valor agregado',
      options: [
        { key: 'saber_pro_valor_agregado_individual', label: 'Valor agregado individual' },
        { key: 'saber_pro_valor_agregado_resultado_general', label: 'Valor agregado resultado general' },
        { key: 'saber_pro_valor_agregado_estadistica_general', label: 'Valor agregado estadistica general' },
        { key: 'saber_pro_valor_agregado_nbc', label: 'Valor agregado NBC' }
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

  // Modales
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('create'); // create | edit
  const [selectedUser, setSelectedUser] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deletingUserIds, setDeletingUserIds] = useState(() => new Set());
  const [openPermissionsDialog, setOpenPermissionsDialog] = useState(false);
  const [permissionsUser, setPermissionsUser] = useState(null);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsSaving, setPermissionsSaving] = useState(false);
  const [modulePermissionsForm, setModulePermissionsForm] = useState({
    menuPermissions: [],
    allowedModules: [],
    allowedGestionProcesosDashboards: [],
    allowedPoblacionalDashboards: [],
    allowedSaberProDashboards: []
  });

  // Formulario
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    username: '',
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
        ROLES.GESTION_INFORMACION
      ];
    }

    if (currentUser?.role === ROLES.GESTION_PROCESOS) {
      return [ROLES.CONSULTA];
    }

    return [];
  }, [currentUser?.role]);

  const defaultAssignableRole = allowedRolesForManager[0] || ROLES.CONSULTA;

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await userService.getUsers({
        page: page + 1,
        limit: rowsPerPage,
        search
      });
      setUsers(response.data.users);
      setTotal(response.data.pagination.total);
    } catch (error) {
      enqueueSnackbar('Error al cargar usuarios', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar, page, rowsPerPage, search]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleOpenDialog = (mode, user = null) => {
    setDialogMode(mode);
    setSelectedUser(user);
    if (user) {
      setFormData({
        nombre: user.nombre,
        email: user.email,
        username: user.username,
        role: user.role
      });
    } else {
      setFormData({
        nombre: '',
        email: '',
        username: '',
        role: defaultAssignableRole
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedUser(null);
    setFormData({ nombre: '', email: '', username: '', role: defaultAssignableRole });
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
        username: String(formData.username || '').trim()
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

  const handleDelete = async (user) => {
    if (deletingUserIds.has(user.id)) return;
    if (window.confirm(`¿Eliminar permanentemente al usuario ${user.nombre}? Esta acción no se puede deshacer.`)) {
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
          response.message || (deletedPhysically ? 'Usuario eliminado' : 'Eliminacion en proceso'),
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
    }
  };

  const handleToggleStatus = async (user) => {
    const nextEstado = user.estado === 'activo' ? 'inactivo' : 'activo';
    const actionText = nextEstado === 'activo' ? 'reactivar' : 'inactivar';

    if (!window.confirm(`¿${actionText.charAt(0).toUpperCase() + actionText.slice(1)} al usuario ${user.nombre}?`)) {
      return;
    }

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

  const handleBulkUpload = async () => {
    if (!uploadFile) {
      enqueueSnackbar('Seleccione un archivo Excel', { variant: 'warning' });
      return;
    }

    setUploading(true);
    try {
      const response = await userService.bulkUpload(uploadFile);

      if (response?.data?.advertencias?.length) {
        const example = response.data.advertencias[0];
        enqueueSnackbar(
          `Se importaron usuarios con advertencias. Ejemplo: ${example.email} sin correo, contraseña temporal disponible.`,
          { variant: 'warning' }
        );
      }
      
      if (response.data.archivoErrores) {
        const binary = atob(response.data.archivoErrores);
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
        link.download = 'errores_carga_usuarios.xlsx';
        link.click();
      }

      enqueueSnackbar(response.message, { variant: 'success' });
      setUploadFile(null);
      loadUsers();
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'Error en carga masiva', { variant: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleTogglePermission = (group, key) => {
    setModulePermissionsForm((prev) => {
      const current = Array.isArray(prev[group]) ? prev[group] : [];
      const isSelected = current.includes(key);
      const next = isSelected ? current.filter((x) => x !== key) : [...current, key];

      // Si se marca un submódulo de Gestión de la Información, se habilita automáticamente
      // el menú padre para evitar estados inconsistentes en la interfaz.
      if (group === 'allowedModules') {
        const nextMenu = Array.isArray(prev.menuPermissions) ? [...prev.menuPermissions] : [];
        let nextGestionProcesosDashboards = Array.isArray(prev.allowedGestionProcesosDashboards) ? [...prev.allowedGestionProcesosDashboards] : [];
        let nextPoblacionalDashboards = Array.isArray(prev.allowedPoblacionalDashboards) ? [...prev.allowedPoblacionalDashboards] : [];
        let nextSaberProDashboards = Array.isArray(prev.allowedSaberProDashboards) ? [...prev.allowedSaberProDashboards] : [];
        if (next.length > 0 && !nextMenu.includes('gestion_informacion')) {
          nextMenu.push('gestion_informacion');
        }
        if (!next.includes('estadistica_institucional')) {
          nextPoblacionalDashboards = [];
          nextGestionProcesosDashboards = [];
          nextSaberProDashboards = [];
        }
        return {
          ...prev,
          allowedModules: next,
          menuPermissions: nextMenu,
          allowedGestionProcesosDashboards: nextGestionProcesosDashboards,
          allowedPoblacionalDashboards: nextPoblacionalDashboards,
          allowedSaberProDashboards: nextSaberProDashboards
        };
      }

      if (group === 'allowedGestionProcesosDashboards') {
        const nextMenu = Array.isArray(prev.menuPermissions) ? [...prev.menuPermissions] : [];
        const nextModules = Array.isArray(prev.allowedModules) ? [...prev.allowedModules] : [];
        if (!nextMenu.includes('gestion_informacion')) nextMenu.push('gestion_informacion');
        if (!nextModules.includes('estadistica_institucional')) nextModules.push('estadistica_institucional');
        return { ...prev, allowedGestionProcesosDashboards: next, allowedModules: nextModules, menuPermissions: nextMenu };
      }

      if (group === 'allowedPoblacionalDashboards') {
        const nextMenu = Array.isArray(prev.menuPermissions) ? [...prev.menuPermissions] : [];
        const nextModules = Array.isArray(prev.allowedModules) ? [...prev.allowedModules] : [];
        if (!nextMenu.includes('gestion_informacion')) nextMenu.push('gestion_informacion');
        if (!nextModules.includes('estadistica_institucional')) nextModules.push('estadistica_institucional');
        return { ...prev, allowedPoblacionalDashboards: next, allowedModules: nextModules, menuPermissions: nextMenu };
      }

      if (group === 'allowedSaberProDashboards') {
        const nextMenu = Array.isArray(prev.menuPermissions) ? [...prev.menuPermissions] : [];
        const nextModules = Array.isArray(prev.allowedModules) ? [...prev.allowedModules] : [];
        if (!nextMenu.includes('gestion_informacion')) nextMenu.push('gestion_informacion');
        if (!nextModules.includes('estadistica_institucional')) nextModules.push('estadistica_institucional');
        return { ...prev, allowedSaberProDashboards: next, allowedModules: nextModules, menuPermissions: nextMenu };
      }

      // Si se quita el menú padre de Gestión de la Información, se limpian sus submódulos.
      if (group === 'menuPermissions' && key === 'gestion_informacion' && isSelected) {
        return {
          ...prev,
          menuPermissions: next,
          allowedModules: [],
          allowedGestionProcesosDashboards: [],
          allowedPoblacionalDashboards: [],
          allowedSaberProDashboards: []
        };
      }

      return { ...prev, [group]: next };
    });
  };

  const handleOpenPermissionsDialog = async (user) => {
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
      const saberProOptionKeys = SABER_PRO_PERMISSION_GROUPS.flatMap((group) => group.options.map((item) => item.key));
      const allowedSaberProDashboards = Object.entries(permissions)
        .filter(([key, value]) => saberProOptionKeys.includes(key) && value?.can_view)
        .map(([key]) => key);
      setModulePermissionsForm({
        menuPermissions: (allowedModules.length > 0 || allowedGestionProcesosDashboards.length > 0 || allowedSaberProDashboards.length > 0) && !menuPermissions.includes('gestion_informacion')
          ? [...menuPermissions, 'gestion_informacion']
          : menuPermissions,
        allowedModules,
        allowedGestionProcesosDashboards,
        allowedPoblacionalDashboards,
        allowedSaberProDashboards
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
    setModulePermissionsForm({ menuPermissions: [], allowedModules: [], allowedGestionProcesosDashboards: [], allowedPoblacionalDashboards: [], allowedSaberProDashboards: [] });
  };

  const handleSavePermissions = async () => {
    if (!permissionsUser) return;
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
    return 'primary';
  };

  const getEstadoColor = (estado) => {
    return estado === 'activo' ? 'success' : 'default';
  };

  const visibleUsers = useMemo(() => {
    const list = Array.isArray(users) ? [...users] : [];
    return list.sort((a, b) => {
      const roleA = ROLE_LABELS[a?.role] || String(a?.role || '');
      const roleB = ROLE_LABELS[b?.role] || String(b?.role || '');
      const roleCompare = roleA.localeCompare(roleB, 'es', { sensitivity: 'base' });
      if (roleCompare !== 0) return roleCompare;
      return String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es', { sensitivity: 'base' });
    });
  }, [users]);

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
                Administra usuarios del sistema institucional (documento, correo y rol)
              </Typography>
            </Box>
          </Stack>
        </Paper>

        {/* Panel principal: buscador + acciones */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, sm: 2.5, md: 3 },
            mb: 3,
            borderRadius: 3,
            border: '1px solid #bfdbfe',
            borderTop: '4px solid #2563eb',
            bgcolor: '#f8fbff'
          }}
        >
          <Typography
            variant="subtitle1"
            sx={{ textAlign: 'center', fontWeight: 800, color: '#1e3a8a', mb: 1.5 }}
          >
            Buscar usuarios por nombre, correo o documento
          </Typography>

          <TextField
            fullWidth
            placeholder="Ej: juan camilo, 1085327166, adsol@unicesmag.edu.co"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: '#64748b' }} />
            }}
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                bgcolor: 'white',
                '& fieldset': { borderColor: '#93c5fd' },
                '&:hover fieldset': { borderColor: '#60a5fa' },
                '&.Mui-focused fieldset': { borderColor: '#3b82f6' }
              }
            }}
          />

          <Stack
            direction="row"
            spacing={1.5}
            useFlexGap
            sx={{ flexWrap: 'wrap', justifyContent: { xs: 'stretch', md: 'center' } }}
          >
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog('create')}
              sx={{
                minWidth: { xs: '100%', sm: 200 },
                borderRadius: 2,
                py: 1.3,
                textTransform: 'none',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                boxShadow: '0 8px 20px rgba(37,99,235,0.28)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
                  boxShadow: '0 10px 22px rgba(29,78,216,0.34)'
                }
              }}
            >
              Crear usuario
            </Button>

            <Button
              variant="outlined"
              component="label"
              startIcon={<UploadIcon />}
              sx={{
                minWidth: { xs: '100%', sm: 220 },
                borderRadius: 2,
                py: 1.3,
                textTransform: 'none',
                fontWeight: 700,
                color: '#1d4ed8',
                borderColor: '#93c5fd',
                bgcolor: '#eff6ff',
                '&:hover': { borderColor: '#60a5fa', bgcolor: '#dbeafe' }
              }}
            >
              {uploadFile ? uploadFile.name : 'Seleccionar Excel'}
              <input
                type="file"
                hidden
                accept=".xlsx,.xls"
                onChange={(e) => setUploadFile(e.target.files[0])}
              />
            </Button>

            <Button
              variant="contained"
              disabled={!uploadFile || uploading}
              onClick={handleBulkUpload}
              sx={{
                minWidth: { xs: '100%', sm: 160 },
                borderRadius: 2,
                py: 1.3,
                textTransform: 'none',
                fontWeight: 800,
                bgcolor: '#2563eb',
                '&:hover': { bgcolor: '#1d4ed8' },
                '&.Mui-disabled': { bgcolor: '#bfdbfe', color: '#1e3a8a' }
              }}
            >
              {uploading ? <CircularProgress size={20} sx={{ color: '#1d4ed8' }} /> : 'Importar'}
            </Button>

            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadTemplate}
              sx={{
                minWidth: { xs: '100%', sm: 160 },
                borderRadius: 2,
                py: 1.3,
                textTransform: 'none',
                fontWeight: 700,
                color: '#1d4ed8',
                borderColor: '#93c5fd',
                bgcolor: '#eff6ff',
                '&:hover': { borderColor: '#60a5fa', bgcolor: '#dbeafe' }
              }}
            >
              Plantilla
            </Button>

            <Button
              variant="outlined"
              startIcon={<ClearIcon />}
              onClick={() => setSearch('')}
              sx={{
                minWidth: { xs: '100%', sm: 180 },
                borderRadius: 2,
                py: 1.3,
                textTransform: 'none',
                fontWeight: 700,
                color: '#1d4ed8',
                borderColor: '#93c5fd',
                bgcolor: '#eff6ff',
                '&:hover': { borderColor: '#60a5fa', bgcolor: '#dbeafe' }
              }}
            >
              Limpiar búsqueda
            </Button>
          </Stack>
        </Paper>

        {/* Tabla de usuarios */}
        <Paper elevation={0} sx={{ border: '1px solid #cbd5e1', borderRadius: 3, overflow: 'hidden', boxShadow: '0 8px 22px rgba(15,23,42,0.06)' }}>
          <TableContainer sx={{ bgcolor: '#ffffff' }}>
            <Table size="small" sx={{ tableLayout: 'auto', minWidth: 920 }}>
              <TableHead>
                <TableRow
                  sx={{
                    background: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 70%, #1e40af 100%)',
                    '& .MuiTableCell-root': {
                      color: 'white',
                      fontWeight: 800,
                      fontSize: 13,
                      borderBottom: '2px solid #1e3a8a',
                      textTransform: 'uppercase',
                      letterSpacing: 0.4
                    }
                  }}
                >
                  <TableCell sx={{ py: 1.6 }}>Nombre</TableCell>
                  <TableCell sx={{ py: 1.6 }}>Email</TableCell>
                  <TableCell sx={{ py: 1.6 }}>Documento</TableCell>
                  <TableCell sx={{ py: 1.6 }}>Rol</TableCell>
                  <TableCell sx={{ py: 1.6 }}>Estado</TableCell>
                  <TableCell align="center" sx={{ py: 1.6 }}>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                      <Typography color="text.secondary">No hay usuarios registrados</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleUsers.map((user, index) => {
                    const isDeleting = deletingUserIds.has(user.id);
                    return (
                    <TableRow
                      key={user.id}
                      hover
                      sx={{
                        bgcolor: index % 2 === 0 ? '#ffffff' : '#f8fafc',
                        '&:hover': { bgcolor: '#eef4ff' },
                        '& .MuiTableCell-root': { borderBottom: '1px solid #e2e8f0' }
                      }}
                    >
                      <TableCell sx={{ fontWeight: 700, py: 1.5, maxWidth: 240, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#0f172a', textTransform: 'uppercase' }}>{user.nombre}</TableCell>
                      <TableCell sx={{ py: 1.5, maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#1e293b' }}>{user.email}</TableCell>
                      <TableCell>
                        <Chip label={user.username} size="small" variant="outlined" sx={{ borderColor: '#94a3b8', color: '#0f172a', bgcolor: '#f8fafc' }} />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={ROLE_LABELS[user.role] || user.role}
                          color={getRoleColor(user.role)}
                          size="small"
                          sx={{ fontWeight: 700, textTransform: 'uppercase', maxWidth: 240 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={user.estado}
                          color={getEstadoColor(user.estado)}
                          size="small"
                          sx={{ fontWeight: 700, textTransform: 'uppercase' }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={1} justifyContent="center">
                          <Tooltip title="Editar">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenDialog('edit', user)}
                              disabled={isDeleting}
                              sx={{ color: '#3b82f6', bgcolor: '#eff6ff', '&:hover': { bgcolor: '#dbeafe' } }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Permisos de módulos">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenPermissionsDialog(user)}
                              disabled={isDeleting}
                              sx={{ color: '#0ea5e9', bgcolor: '#e0f2fe', '&:hover': { bgcolor: '#bae6fd' } }}
                            >
                              <SecurityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={user.estado === 'activo' ? 'Inactivar' : 'Reactivar'}>
                            <IconButton
                              size="small"
                              onClick={() => handleToggleStatus(user)}
                              disabled={isDeleting}
                              sx={{ color: user.estado === 'activo' ? '#f59e0b' : '#10b981', bgcolor: '#fef3c7', '&:hover': { bgcolor: '#fde68a' } }}
                            >
                              {user.estado === 'activo' ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Eliminar Permanente">
                            <IconButton
                              size="small"
                              onClick={() => handleDelete(user)}
                              disabled={isDeleting}
                              sx={{ color: '#ef4444', bgcolor: '#fee2e2', '&:hover': { bgcolor: '#fecaca' } }}
                            >
                              {isDeleting ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon fontSize="small" />}
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
                                    || modulePermissionsForm.allowedSaberProDashboards.length > 0
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
                  <Typography sx={{ fontWeight: 800, mb: 1, color: '#0f172a' }}>Módulos de Gestión de la Información</Typography>
                  <FormGroup>
                    <Grid container spacing={0.5}>
                      {GI_MODULE_OPTIONS.map((item) => (
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

                <Divider />

                <Paper
                  variant="outlined"
                  sx={{ p: 2, borderRadius: 2, opacity: modulePermissionsForm.allowedModules.includes('estadistica_institucional') ? 1 : 0.55 }}
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
                                disabled={!modulePermissionsForm.allowedModules.includes('estadistica_institucional')}
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
                  sx={{ p: 2, borderRadius: 2, opacity: modulePermissionsForm.allowedModules.includes('estadistica_institucional') ? 1 : 0.55 }}
                >
                  <Typography sx={{ fontWeight: 800, mb: 0.6, color: '#0f172a' }}>Permisos modulares de Saber Pro</Typography>
                  <Typography variant="body2" sx={{ color: '#64748b', mb: 1.6 }}>
                    Activa solo los bloques que necesite el usuario: consulta y validaciÃ³n, resultados individuales, agregados o valor agregado.
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
                                      disabled={!modulePermissionsForm.allowedModules.includes('estadistica_institucional')}
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
