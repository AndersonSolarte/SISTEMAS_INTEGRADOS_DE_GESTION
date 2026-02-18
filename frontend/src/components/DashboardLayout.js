import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Box, Drawer, AppBar, Toolbar, List, Typography, IconButton, ListItemButton, ListItemIcon, ListItemText, Menu, MenuItem, Avatar, Chip, Divider, Tooltip } from '@mui/material';
import { Menu as MenuIcon, AccountCircle, Dashboard as DashboardIcon, CheckCircle as CheckIcon, Logout as LogoutIcon, Settings as SettingsIcon } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const drawerWidth = 280;

function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const handleLogout = () => {
    setAnchorEl(null);
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  const menuItems = [
    { path: '/dashboard', label: 'Inicio', icon: <DashboardIcon /> },
    { path: '/dashboard/aseguramiento-calidad', label: 'Aseguramiento de Calidad', icon: <CheckIcon /> }
  ];

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#1e293b' }}>
      <Toolbar sx={{ bgcolor: '#0f172a', display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={{ color: 'white', fontWeight: 700, fontSize: 20 }}>SGC</Typography>
        </Box>
        <Box>
          <Typography variant="h6" sx={{ color: 'white', fontWeight: 600, fontSize: 16 }}>Sistema de Gestión</Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: 11 }}>de Calidad</Typography>
        </Box>
      </Toolbar>
      
      <Divider sx={{ borderColor: '#334155' }} />
      
      <List sx={{ px: 2, py: 2, flexGrow: 1 }}>
        {menuItems.map((item) => (
          <ListItemButton
            key={item.path}
            onClick={() => { navigate(item.path); setMobileOpen(false); }}
            sx={{
              mb: 1,
              borderRadius: 2,
              bgcolor: isActive(item.path) ? '#3b82f6' : 'transparent',
              color: isActive(item.path) ? 'white' : '#cbd5e1',
              transition: 'all 0.2s',
              '&:hover': {
                bgcolor: isActive(item.path) ? '#2563eb' : '#334155',
                transform: 'translateX(4px)'
              }
            }}
          >
            <ListItemIcon sx={{ color: isActive(item.path) ? 'white' : '#94a3b8', minWidth: 40 }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText 
              primary={item.label}
              primaryTypographyProps={{ fontSize: 14, fontWeight: isActive(item.path) ? 600 : 400 }}
            />
          </ListItemButton>
        ))}
      </List>

      <Divider sx={{ borderColor: '#334155' }} />
      
      <Box sx={{ p: 2 }}>
        <Box sx={{ bgcolor: '#0f172a', borderRadius: 2, p: 2 }}>
          <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mb: 1 }}>Usuario activo</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: '#3b82f6', fontSize: 14 }}>
              {user?.nombre?.charAt(0) || 'U'}
            </Avatar>
            <Box sx={{ flexGrow: 1 }}>
              <Typography sx={{ color: 'white', fontSize: 13, fontWeight: 500 }}>{user?.nombre}</Typography>
              <Chip label={user?.role === 'administrador' ? 'Admin' : 'Consulta'} size="small" sx={{ height: 18, fontSize: 10, bgcolor: user?.role === 'administrador' ? '#10b981' : '#6366f1', color: 'white' }} />
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" elevation={0} sx={{ width: { sm: `calc(100% - ${drawerWidth}px)` }, ml: { sm: `${drawerWidth}px` }, bgcolor: 'white', borderBottom: '1px solid #e2e8f0' }}>
        <Toolbar>
          <IconButton color="primary" edge="start" onClick={() => setMobileOpen(!mobileOpen)} sx={{ mr: 2, display: { sm: 'none' } }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, color: '#1e293b', fontWeight: 600 }}>Sistema de Gestión de Calidad</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Tooltip title="Configuración">
              <IconButton size="small" sx={{ color: '#64748b' }}>
                <SettingsIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Mi cuenta">
              <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ p: 0 }}>
                <Avatar sx={{ width: 36, height: 36, bgcolor: '#3b82f6' }}>
                  {user?.nombre?.charAt(0) || 'U'}
                </Avatar>
              </IconButton>
            </Tooltip>
          </Box>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)} transformOrigin={{ horizontal: 'right', vertical: 'top' }} anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}>
            <MenuItem disabled>
              <Box>
                <Typography variant="subtitle2">{user?.nombre}</Typography>
                <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
              </Box>
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <LogoutIcon sx={{ mr: 1, fontSize: 20 }} />
              Cerrar Sesión
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      
      <Box component="nav" sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}>
        <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(!mobileOpen)} ModalProps={{ keepMounted: true }} sx={{ display: { xs: 'block', sm: 'none' }, '& .MuiDrawer-paper': { width: drawerWidth, border: 'none' } }}>
          {drawer}
        </Drawer>
        <Drawer variant="permanent" sx={{ display: { xs: 'none', sm: 'block' }, '& .MuiDrawer-paper': { width: drawerWidth, border: 'none' } }} open>
          {drawer}
        </Drawer>
      </Box>
      
      <Box component="main" sx={{ flexGrow: 1, p: 3, width: { sm: `calc(100% - ${drawerWidth}px)` }, bgcolor: '#f8fafc', minHeight: '100vh' }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}

export default DashboardLayout;