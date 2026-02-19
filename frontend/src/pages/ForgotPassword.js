import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Paper, TextField, Button, Typography, Box, Alert, CircularProgress, Fade
} from '@mui/material';
import { Email as EmailIcon, ArrowBack as BackIcon } from '@mui/icons-material';
import userService from '../services/userService';

function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await userService.requestPasswordReset(email);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al procesar solicitud');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <Box sx={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', filter: 'blur(60px)' }} />
      <Box sx={{ position: 'absolute', bottom: -150, left: -150, width: 500, height: 500, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', filter: 'blur(80px)' }} />

      <Container maxWidth="sm" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        <Fade in={true} timeout={800}>
          <Paper elevation={24} sx={{
            p: 5,
            borderRadius: 4,
            width: '100%',
            maxWidth: 480,
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
          }}>
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Box sx={{
                width: 80,
                height: 80,
                borderRadius: 4,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                mb: 3,
                boxShadow: '0 8px 24px rgba(102, 126, 234, 0.4)'
              }}>
                <EmailIcon sx={{ color: 'white', fontSize: 40 }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#1e293b', mb: 1 }}>
                Recuperar Contraseña
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b' }}>
                Ingresa tu correo institucional para recibir instrucciones
              </Typography>
            </Box>

            {success ? (
              <Fade in={true}>
                <Box>
                  <Alert severity="success" sx={{ mb: 3 }}>
                    ¡Correo enviado! Revisa tu bandeja de entrada y sigue las instrucciones.
                  </Alert>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<BackIcon />}
                    onClick={() => navigate('/login')}
                    sx={{ borderRadius: 2, py: 1.5 }}
                  >
                    Volver al Login
                  </Button>
                </Box>
              </Fade>
            ) : (
              <Box component="form" onSubmit={handleSubmit}>
                {error && (
                  <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                  </Alert>
                )}

                <Alert severity="info" sx={{ mb: 3 }}>
                  El correo debe pertenecer al dominio @unicesmag.edu.co
                </Alert>

                <TextField
                  fullWidth
                  label="Correo Institucional"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  sx={{
                    mb: 3,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      bgcolor: '#f8fafc'
                    }
                  }}
                />

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={loading}
                  sx={{
                    py: 1.8,
                    borderRadius: 2,
                    textTransform: 'none',
                    fontSize: 16,
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    boxShadow: '0 4px 14px rgba(102, 126, 234, 0.4)',
                    mb: 2
                  }}
                >
                  {loading ? <CircularProgress size={24} color="inherit" /> : 'Enviar Enlace de Recuperación'}
                </Button>

                <Button
                  fullWidth
                  variant="text"
                  startIcon={<BackIcon />}
                  onClick={() => navigate('/login')}
                  sx={{ textTransform: 'none' }}
                >
                  Volver al Login
                </Button>
              </Box>
            )}
          </Paper>
        </Fade>
      </Container>
    </Box>
  );
}

export default ForgotPassword;