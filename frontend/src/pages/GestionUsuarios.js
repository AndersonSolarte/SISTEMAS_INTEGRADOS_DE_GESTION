import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, IconButton, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Select, MenuItem, FormControl, InputLabel,
  Chip, Grid, Alert, CircularProgress, Fade
  , Stack
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Upload as UploadIcon,
  Download as DownloadIcon, Search as SearchIcon, Clear as ClearIcon,
  Block as BlockIcon, CheckCircle as CheckCircleIcon, Key as KeyIcon,
  GroupOutlined as GroupIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import userService from '../services/userService';

function GestionUsuarios() {
  const { enqueueSnackbar } = useSnackbar();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');

  // Modales
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('create'); // create | edit
  const [selectedUser, setSelectedUser] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Formulario
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    username: '',
    role: 'consulta'
  });

  useEffect(() => {
    loadUsers();
  }, [page, rowsPerPage, search, filterRole]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await userService.getUsers({
        page: page + 1,
        limit: rowsPerPage,
        search,
        role: filterRole
      });
      setUsers(response.data.users);
      setTotal(response.data.pagination.total);
    } catch (error) {
      enqueueSnackbar('Error al cargar usuarios', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

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
        role: 'consulta'
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedUser(null);
    setFormData({ nombre: '', email: '', username: '', role: 'consulta' });
  };

  const handleSubmit = async () => {
    try {
      if (dialogMode === 'create') {
        const response = await userService.createUser(formData);
        enqueueSnackbar(response.message || 'Usuario creado exitosamente', { variant: response.data?.emailEnviado ? 'success' : 'warning' });

        if (response.data && response.data.emailEnviado === false && response.data.passwordTemporal) {
          window.alert(
            `No se pudo enviar correo.\n\nEntrega estas credenciales al usuario:\nUsuario: ${response.data.user?.username || response.data.user?.email}\nContraseña temporal: ${response.data.passwordTemporal}\n\nDetalle SMTP: ${response.data.errorEmail || 'No disponible'}`
          );
        }
      } else {
        await userService.updateUser(selectedUser.id, formData);
        enqueueSnackbar('Usuario actualizado exitosamente', { variant: 'success' });
      }
      handleCloseDialog();
      loadUsers();
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'Error al guardar usuario', { variant: 'error' });
    }
  };

  const handleDelete = async (user) => {
    if (window.confirm(`¿Eliminar permanentemente al usuario ${user.nombre}? Esta acción no se puede deshacer.`)) {
      try {
        await userService.deleteUser(user.id);
        enqueueSnackbar('Usuario eliminado permanentemente', { variant: 'success' });
        loadUsers();
      } catch (error) {
        enqueueSnackbar(error.response?.data?.message || 'Error al eliminar usuario', { variant: 'error' });
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
      enqueueSnackbar(response.message || `Usuario ${actionText}do exitosamente`, { variant: 'success' });
      loadUsers();
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || `Error al ${actionText} usuario`, { variant: 'error' });
    }
  };

  const handleResetTempPassword = async (user) => {
    if (!window.confirm(`¿Resetear contraseña temporal para ${user.nombre}?`)) return;

    try {
      const response = await userService.resetTempPassword(user.id);
      enqueueSnackbar(response.message, { variant: response.data?.emailEnviado ? 'success' : 'warning' });

      if (response.data && response.data.emailEnviado === false && response.data.passwordTemporal) {
        window.alert(
          `No se pudo enviar correo.\n\nEntrega estas credenciales al usuario:\nUsuario: ${response.data.user?.username || response.data.user?.email}\nContraseña temporal: ${response.data.passwordTemporal}\n\nDetalle SMTP: ${response.data.errorEmail || 'No disponible'}`
        );
      }
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'Error al resetear contraseña temporal', { variant: 'error' });
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
        // Descargar archivo de errores
        const blob = new Blob([Buffer.from(response.data.archivoErrores, 'base64')], {
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
      enqueueSnackbar('Error en carga masiva', { variant: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const getRoleColor = (role) => {
    return role === 'administrador' ? 'error' : 'primary';
  };

  const getEstadoColor = (estado) => {
    return estado === 'activo' ? 'success' : 'default';
  };

  return (
    <Fade in={true}>
      <Box>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 1 }}>
            <GroupIcon sx={{ color: '#1d4ed8' }} />
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#1e293b' }}>
              Gestión de Usuarios
            </Typography>
          </Stack>
          <Typography variant="body2" sx={{ color: '#64748b' }}>
            Administra usuarios del sistema institucional
          </Typography>
        </Box>

        {/* Acciones principales */}
        <Paper elevation={0} sx={{ p: 3, mb: 3, border: '1px solid #e2e8f0', borderRadius: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                fullWidth
                onClick={() => handleOpenDialog('create')}
                sx={{ borderRadius: 2, py: 1.5 }}
              >
                Crear Usuario
              </Button>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                variant="outlined"
                component="label"
                startIcon={<UploadIcon />}
                fullWidth
                sx={{ borderRadius: 2, py: 1.5 }}
              >
                {uploadFile ? uploadFile.name : 'Seleccionar Excel'}
                <input
                  type="file"
                  hidden
                  accept=".xlsx,.xls"
                  onChange={(e) => setUploadFile(e.target.files[0])}
                />
              </Button>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                variant="contained"
                color="secondary"
                disabled={!uploadFile || uploading}
                onClick={handleBulkUpload}
                fullWidth
                sx={{ borderRadius: 2, py: 1.5 }}
              >
                {uploading ? <CircularProgress size={20} /> : 'Importar'}
              </Button>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Buscar por nombre, email o usuario..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: '#64748b' }} />
                }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Grid>
          </Grid>
        </Paper>

        {/* Filtros */}
        <Paper elevation={0} sx={{ p: 2, mb: 3, border: '1px solid #e2e8f0', borderRadius: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Filtrar por rol</InputLabel>
                <Select
                  value={filterRole}
                  label="Filtrar por rol"
                  onChange={(e) => setFilterRole(e.target.value)}
                  sx={{ borderRadius: 2 }}
                >
                  <MenuItem value="">Todos</MenuItem>
                  <MenuItem value="administrador">Administrador</MenuItem>
                  <MenuItem value="consulta">Consulta</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                variant="outlined"
                startIcon={<ClearIcon />}
                fullWidth
                onClick={() => {
                  setSearch('');
                  setFilterRole('');
                }}
                sx={{ borderRadius: 2 }}
              >
                Limpiar
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Tabla de usuarios */}
        <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 700, color: '#1e293b' }}>Nombre</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#1e293b' }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#1e293b' }}>Usuario</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#1e293b' }}>Rol</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#1e293b' }}>Estado</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, color: '#1e293b' }}>Acciones</TableCell>
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
                  users.map((user) => (
                    <TableRow key={user.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{user.nombre}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Chip label={user.username} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={user.role}
                          color={getRoleColor(user.role)}
                          size="small"
                          sx={{ fontWeight: 700, textTransform: 'uppercase' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={user.estado}
                          color={getEstadoColor(user.estado)}
                          size="small"
                          sx={{ fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Editar">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDialog('edit', user)}
                            sx={{ color: '#3b82f6' }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Reset Contraseña">
                          <IconButton
                            size="small"
                            onClick={() => handleResetTempPassword(user)}
                            sx={{ color: '#7c3aed' }}
                          >
                            <KeyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={user.estado === 'activo' ? 'Inactivar' : 'Reactivar'}>
                          <IconButton
                            size="small"
                            onClick={() => handleToggleStatus(user)}
                            sx={{ color: user.estado === 'activo' ? '#f59e0b' : '#10b981' }}
                          >
                            {user.estado === 'activo' ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Eliminar Permanente">
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(user)}
                            sx={{ color: '#ef4444' }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
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
                label="Nombre Completo"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                sx={{ mb: 2 }}
                required
              />
              <TextField
                fullWidth
                label="Correo Institucional"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                sx={{ mb: 2 }}
                required
                helperText="Debe terminar en @unicesmag.edu.co"
              />
              <TextField
                fullWidth
                label="Usuario (Username)"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                sx={{ mb: 2 }}
                required
              />
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Rol</InputLabel>
                <Select
                  value={formData.role}
                  label="Rol"
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  <MenuItem value="consulta">Consulta</MenuItem>
                  <MenuItem value="administrador">Administrador</MenuItem>
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
      </Box>
    </Fade>
  );
}

export default GestionUsuarios;
