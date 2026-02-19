import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Container, Paper, TextField, Button, Typography, Box, Alert, CircularProgress, InputAdornment, IconButton, Fade, Slide, Divider } from '@mui/material';
import { LockOutlined as LockIcon, Email as EmailIcon, Visibility, VisibilityOff, Login as LoginIcon } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(formData.email, formData.password);
    setLoading(false);
    if (result.success) {
      if (result.requiresPasswordChange) {
        navigate('/primer-acceso');
        return;
      }
      navigate('/dashboard');
    } else {
      setError(result.message || 'Credenciales inválidas');
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      background: '#ffffff',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(130deg, #ffffff 0%, #f1f5f9 42%, #eff6ff 100%)' }} />
      <Box sx={{ position: 'absolute', top: -110, right: -120, width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,84,166,0.16) 0%, rgba(0,84,166,0) 70%)' }} />
      <Box sx={{ position: 'absolute', bottom: -180, left: -130, width: 460, height: 460, borderRadius: '50%', background: 'radial-gradient(circle, rgba(193,33,50,0.14) 0%, rgba(193,33,50,0) 70%)' }} />
      
      <Container maxWidth="sm" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        <Fade in={true} timeout={800}>
          <Paper elevation={24} sx={{
            p: 5,
            borderRadius: 4, 
            width: '100%',
            maxWidth: 520,
            background: '#ffffff',
            border: '1px solid #d7e5f7',
            boxShadow: '0 20px 55px rgba(10, 24, 47, 0.14)'
          }}>
            <Slide direction="down" in={true} timeout={600}>
              <Box>
                <Box sx={{ textAlign: 'center', mb: 4 }}>
                  <Box sx={{ 
                    width: 150, 
                    height: 150, 
                    borderRadius: '50%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    margin: '0 auto',
                    mb: 3,
                    overflow: 'hidden'
                  }}>
                    <Box
                      component="img"
                      src="/escudo.png"
                      alt="Escudo CESMAG"
                      sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 900, color: '#0f172a', mb: 1, letterSpacing: -0.6 }}>
                    Plataforma Institucional
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#0b5cab', mb: 0.8 }}>
                    Sistemas de Gestión por Procesos
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#475569', fontSize: 13, mb: 1.8 }}>
                    Accede con tus credenciales institucionales para consultar la documentación oficial.
                  </Typography>
                  <Divider sx={{ borderColor: '#e2e8f0' }} />
                </Box>

                {error && (
                  <Fade in={true}>
                    <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                      {error}
                    </Alert>
                  </Fade>
                )}

                <Box component="form" onSubmit={handleSubmit}>
                  <TextField
                    margin="normal"
                    required
                    fullWidth
                    label="Correo o Usuario"
                    name="email"
                    autoComplete="username"
                    autoFocus
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    disabled={loading}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <EmailIcon sx={{ color: '#0b5cab' }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      mb: 2,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        bgcolor: '#ffffff',
                        transition: 'all 0.3s',
                        '&:hover': {
                          bgcolor: '#f8fafc'
                        },
                        '&.Mui-focused': {
                          bgcolor: 'white'
                        }
                      }
                    }}
                  />

                  <TextField
                    margin="normal"
                    required
                    fullWidth
                    name="password"
                    label="Contraseña"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    disabled={loading}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockIcon sx={{ color: '#0b5cab' }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      )
                    }}
                    sx={{
                      mb: 1,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        bgcolor: '#ffffff',
                        transition: 'all 0.3s',
                        '&:hover': {
                          bgcolor: '#f8fafc'
                        },
                        '&.Mui-focused': {
                          bgcolor: 'white'
                        }
                      }
                    }}
                  />

                  <Box sx={{ textAlign: 'right', mb: 3 }}>
                    <Link 
                      to="/forgot-password" 
                      style={{ 
                        color: '#0b5cab',
                        textDecoration: 'none', 
                        fontSize: 14,
                        fontWeight: 600
                      }}
                    >
                      ¿Olvidaste tu contraseña?
                    </Link>
                  </Box>

                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    size="large"
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <LoginIcon />}
                    sx={{
                      py: 1.8,
                      borderRadius: 2,
                      textTransform: 'none',
                      fontSize: 16,
                      fontWeight: 700,
                      background: 'linear-gradient(135deg, #0054a6 0%, #c12132 100%)',
                      boxShadow: '0 8px 20px rgba(0, 84, 166, 0.35)',
                      transition: 'all 0.3s',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #004786 0%, #a80f24 100%)',
                        boxShadow: '0 12px 26px rgba(0, 70, 138, 0.42)'
                      }
                    }}
                  >
                    {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                  </Button>
                </Box>

                <Box sx={{ mt: 4, p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px dashed #bfd4ea' }}>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block', mb: 1 }}>
                    Usuarios de prueba:
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#475569', display: 'block', fontFamily: 'monospace', fontSize: 11 }}>
                    • admin@sgc.com / Admin123!
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#475569', display: 'block', fontFamily: 'monospace', fontSize: 11 }}>
                    • consulta@sgc.com / Consulta123!
                  </Typography>
                </Box>
              </Box>
            </Slide>
          </Paper>
        </Fade>
      </Container>
    </Box>
  );
}

export default Login;
