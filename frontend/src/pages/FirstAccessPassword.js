import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  TextField,
  Typography
} from '@mui/material';
import { useAuth } from '../context/AuthContext';

function FirstAccessPassword() {
  const navigate = useNavigate();
  const { changePassword } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('La confirmación no coincide con la nueva contraseña.');
      return;
    }

    setLoading(true);
    const response = await changePassword(currentPassword, newPassword);
    setLoading(false);

    if (!response.success) {
      setError(response.message || 'No se pudo actualizar la contraseña.');
      return;
    }

    setSuccess('Contraseña actualizada correctamente.');
    setTimeout(() => navigate('/dashboard'), 900);
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', background: 'linear-gradient(120deg, #0f766e 0%, #0e7490 100%)' }}>
      <Container maxWidth="sm" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Paper elevation={16} sx={{ p: 4, borderRadius: 3, width: '100%' }}>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, color: '#0f172a' }}>
            Primer ingreso
          </Typography>
          <Typography variant="body2" sx={{ color: '#475569', mb: 3 }}>
            Por seguridad debes cambiar la contraseña temporal para continuar.
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Contraseña temporal"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Nueva contraseña"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Confirmar nueva contraseña"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              sx={{ mb: 3 }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
              sx={{ py: 1.4, textTransform: 'none', fontWeight: 700 }}
            >
              {loading ? <CircularProgress size={22} color="inherit" /> : 'Actualizar contraseña'}
            </Button>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}

export default FirstAccessPassword;
