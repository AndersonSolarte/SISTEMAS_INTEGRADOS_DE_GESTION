import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Paper, Button, Typography, Box, Alert, CircularProgress, Divider, Dialog, DialogTitle, DialogContent, DialogActions, Stack } from '@mui/material';
import { Shield as ShieldIcon, Schema as SchemaIcon, VerifiedUser as VerifiedUserIcon } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';
import AppLoader from '../components/AppLoader';
import VigiladaMineducacion from '../components/VigiladaMineducacion';
import LoginParticles from '../components/LoginParticles';

/* Duración del loader de transición post-autenticación (ms) */
const AUTH_LOADER_MS = 2500;
const AUTH_FADE_MS   = 560;

function Login() {
  const navigate = useNavigate();
  const { user, loading: authLoading, loginWithGoogle, hydrateFromToken } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [showContactDialog, setShowContactDialog] = useState(false);
  /* Loader de transición post-autenticación */
  const [transitioning, setTransitioning] = useState(false);
  const [transitionFadeOut, setTransitionFadeOut] = useState(false);
  const googleButtonRef = useRef(null);
  const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
  const currentOrigin = window.location.origin;

  /* Muestra el AppLoader durante AUTH_LOADER_MS y luego navega.
     replace:true evita que el usuario pueda volver al login con el botón Atrás. */
  const navigateWithLoader = useCallback((path) => {
    setTransitioning(true);          // dispara también la destrucción de partículas
    setTransitionFadeOut(false);
    setTimeout(() => setTransitionFadeOut(true), AUTH_LOADER_MS - AUTH_FADE_MS);
    setTimeout(() => navigate(path, { replace: true }), AUTH_LOADER_MS);
  }, [navigate]);

  useEffect(() => {
    if (!authLoading && user?.id && !transitioning) {
      navigateWithLoader('/dashboard');
    }
  }, [authLoading, user?.id, transitioning, navigateWithLoader]);

  const getContactCopy = (message = '') => {
    const text = String(message || '').toLowerCase();
    if (text.includes('inactivo')) {
      return 'Tu usuario está inactivo. Comunícate con el administrador para reactivarlo.';
    }
    if (text.includes('no está registrado') || text.includes('no esta registrado') || text.includes('no registrado')) {
      return 'Tu correo institucional no está registrado. Solicita creación de usuario al administrador.';
    }
    if (text.includes('institucional') || text.includes('dominio')) {
      return 'Debes ingresar con tu correo institucional autorizado. Si el problema persiste, contacta al administrador.';
    }
    if (text.includes('origin_mismatch') || text.includes('oauth')) {
      return 'Google bloqueó el acceso por configuración OAuth. Debes registrar el origen actual del navegador en Google Cloud Console (Authorized JavaScript origins).';
    }
    return 'No fue posible iniciar sesión. Comunícate con el administrador para revisar tu acceso.';
  };

  const handleGoogleCredential = useCallback(async (response) => {
    setError('');
    setShowContactDialog(false);

    if (!response?.credential) {
      setError(`Google no devolvió credencial. Revisa OAuth (origin_mismatch) para este origen: ${currentOrigin}`);
      setShowContactDialog(true);
      return;
    }

    setLoading(true);
    const result = await loginWithGoogle(response?.credential);
    setLoading(false);
    if (result.success) {
      navigateWithLoader('/dashboard');
    } else {
      setError(result.message || 'No fue posible iniciar sesión con Google');
      setShowContactDialog(true);
    }
  }, [currentOrigin, loginWithGoogle, navigateWithLoader]);

  /* ── Token via URL hash (redirect OAuth flow) ── */
  useEffect(() => {
    const hash = String(window.location.hash || '');
    if (!hash || hash.length <= 1) return;

    const params = new URLSearchParams(hash.slice(1));
    const token = params.get('token');
    const googleError = params.get('google_error');
    if (!token && !googleError) return;

    const cleanUrl = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState({}, document.title, cleanUrl);

    if (googleError) {
      setError(googleError);
      setShowContactDialog(true);
      return;
    }

    if (token) {
      setLoading(true);
      authService.setToken(token);
      hydrateFromToken().then((result) => {
        setLoading(false);
        if (result?.success) {
          navigateWithLoader('/dashboard');
        } else {
          setError(result?.message || 'No fue posible iniciar sesión con Google');
          setShowContactDialog(true);
        }
      });
    }
  }, [hydrateFromToken, navigateWithLoader]);

  /* ── Seguridad: consola + clic derecho ── */
  useEffect(() => {
    /* Mensaje disuasivo en consola */
    // eslint-disable-next-line no-console
    console.clear();
    // eslint-disable-next-line no-console
    console.log(
      '%c⚠ Universidad CESMAG — Sistema Restringido',
      'font-size:18px;font-weight:900;color:#1d4ed8;background:#eff6ff;padding:6px 14px;border-radius:6px;'
    );
    // eslint-disable-next-line no-console
    console.log(
      '%cSi alguien te indicó pegar código aquí, podría ser un ataque de ingeniería social. El acceso no autorizado viola la política de seguridad institucional.',
      'font-size:12px;color:#64748b;'
    );

    /* Deshabilitar clic derecho en la página de login */
    const blockCtx = (e) => e.preventDefault();
    document.addEventListener('contextmenu', blockCtx);
    return () => document.removeEventListener('contextmenu', blockCtx);
  }, []);

  /* ── Google SDK init ── */
  useEffect(() => {
    let cancelled = false;

    const initGoogle = () => {
      if (cancelled) return;
      if (!clientId) {
        setError('Falta configurar REACT_APP_GOOGLE_CLIENT_ID en el frontend.');
        return;
      }
      if (!window.google?.accounts?.id) {
        setTimeout(initGoogle, 250);
        return;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredential,
        ux_mode: 'popup',
        auto_select: false
      });

      if (googleButtonRef.current) {
        googleButtonRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          type: 'icon',
          theme: 'outline',
          size: 'large',
          shape: 'circle'
        });
      }

      setGoogleReady(true);
    };

    initGoogle();

    return () => {
      cancelled = true;
      if (window.google?.accounts?.id) {
        window.google.accounts.id.cancel();
      }
    };
  }, [clientId, handleGoogleCredential]);

  const features = [
    { icon: <ShieldIcon sx={{ fontSize: 22 }} />, label: 'Acceso seguro institucional' },
    { icon: <SchemaIcon sx={{ fontSize: 22 }} />, label: 'Gestión por procesos' },
    { icon: <VerifiedUserIcon sx={{ fontSize: 22 }} />, label: 'Documentación oficial verificada' }
  ];

  return (
    <>
    {/* Loader de transición post-autenticación */}
    {transitioning && <AppLoader fadeOut={transitionFadeOut} />}
    <Box sx={{
      minHeight: '100dvh',
      height: '100dvh',
      display: 'flex',
      position: 'relative',
      overflowX: 'hidden',
      overflowY: 'hidden',
      background: '#060e1a'
    }}>
      {/* ── Gradient overlays ── */}
      <Box sx={{
        position: 'absolute',
        inset: 0,
        background: `
          linear-gradient(135deg, rgba(6,14,26,0.92) 0%, rgba(10,28,56,0.75) 40%, rgba(15,45,87,0.45) 70%, rgba(25,65,120,0.3) 100%),
          radial-gradient(ellipse at 20% 80%, rgba(29,78,216,0.18) 0%, transparent 60%),
          radial-gradient(ellipse at 80% 20%, rgba(124,58,237,0.12) 0%, transparent 50%)
        `
      }} />

      {/* ── Canvas partículas interactivas (reemplaza mesh estático) ── */}
      <LoginParticles destroying={transitioning} />

      {/* ── Main content ── */}
      <Container
        maxWidth="lg"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: { xs: 'center', md: 'flex-end' },
          px: { xs: 2, sm: 3 },
          py: { xs: 2, sm: 3, md: 4 },
          pr: { md: 2, lg: 6 },
          position: 'relative',
          zIndex: 2
        }}
      >
        {/* ── Left branding (desktop only) ── */}
        <Box sx={{
          display: { xs: 'none', lg: 'flex' },
          flexDirection: 'column',
          flex: 1,
          pr: 8
        }}>
          <Typography sx={{
            fontFamily: '"Montserrat", "Segoe UI", sans-serif',
            fontWeight: 800,
            fontSize: { lg: '2.4rem', xl: '2.8rem' },
            lineHeight: 1.15,
            color: '#ffffff',
            mb: 2,
            textShadow: '0 2px 20px rgba(0,0,0,0.4)'
          }}>
            Plataforma de{' '}
            <Box component="span" sx={{
              background: 'linear-gradient(90deg, #60a5fa 0%, #a78bfa 50%, #f472b6 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              Gestión Institucional
            </Box>
          </Typography>
          <Typography sx={{
            fontFamily: '"Montserrat", "Segoe UI", sans-serif',
            color: 'rgba(203,213,225,0.9)',
            fontSize: 16,
            lineHeight: 1.6,
            mb: 4,
            maxWidth: 480
          }}>
            Accede a la documentación oficial, estadísticas institucionales y herramientas de gestión de la Universidad CESMAG.
          </Typography>
          <Stack spacing={1.5}>
            {features.map((item, idx) => (
              <Stack
                key={idx}
                direction="row"
                spacing={1.5}
                alignItems="center"
                sx={{ opacity: 1 }}
              >
                <Box sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(59,130,246,0.15)',
                  border: '1px solid rgba(59,130,246,0.25)',
                  color: '#93c5fd',
                  backdropFilter: 'blur(8px)'
                }}>
                  {item.icon}
                </Box>
                <Typography sx={{
                  fontFamily: '"Montserrat", "Segoe UI", sans-serif',
                  color: 'rgba(226,232,240,0.95)',
                  fontSize: 14.5,
                  fontWeight: 600
                }}>
                  {item.label}
                </Typography>
              </Stack>
            ))}
          </Stack>

          {/* Sello Vigilada MINEDUCACIÓN — panel izquierdo */}
          <Box sx={{ mt: 4, alignSelf: 'flex-start' }}>
            <VigiladaMineducacion variant="dark" size="md" />
          </Box>
        </Box>

        {/* ── Login card ── */}
        <Paper
          elevation={0}
          sx={{
            px: { xs: 3, sm: 4.5 },
            pt: { xs: 4, sm: 5 },
            pb: { xs: 4.5, sm: 5.5 },
            borderRadius: { xs: 3.5, sm: 4.5 },
            width: '100%',
            maxWidth: 480,
            minHeight: { sm: 520 },
            background: 'linear-gradient(165deg, rgba(255,255,255,0.97) 0%, rgba(241,245,249,0.95) 60%, rgba(224,231,240,0.93) 100%)',
            border: '1px solid rgba(148,168,198,0.3)',
            boxShadow: `
              0 4px 6px rgba(0,0,0,0.04),
              0 10px 30px rgba(0,0,0,0.12),
              0 40px 80px rgba(0,0,0,0.2),
              inset 0 1px 0 rgba(255,255,255,0.9)
            `,
            backdropFilter: 'blur(20px) saturate(1.5)',
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0, left: 0, right: 0,
              height: 4,
              background: 'linear-gradient(90deg, #1d4ed8 0%, #7c3aed 50%, #ec4899 100%)',
              borderRadius: '4px 4px 0 0'
            }
          }}
        >
          {/* ── Header ── */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            {/* Orbital spinner — visible mientras el SDK de Google inicializa */}
            <Box sx={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: googleReady ? 0 : 2.5,
              height: googleReady ? 0 : 90,
              overflow: 'hidden',
              opacity: googleReady ? 0 : 1,
              transition: 'height 0.55s cubic-bezier(0.4,0,0.2,1) 0.25s, opacity 0.28s ease, margin 0.55s ease 0.25s',
              pointerEvents: 'none'
            }}>
              <Box sx={{ position: 'relative', width: 90, height: 90, flexShrink: 0 }}>
                <Box sx={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  border: '2.5px solid transparent',
                  borderTopColor: '#3b82f6',
                  borderRightColor: 'rgba(59,130,246,0.2)',
                  animation: 'loginOrbit1 1.9s linear infinite',
                  '@keyframes loginOrbit1': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } }
                }} />
                <Box sx={{
                  position: 'absolute', inset: 10, borderRadius: '50%',
                  border: '2px solid transparent',
                  borderTopColor: '#7c3aed',
                  borderLeftColor: 'rgba(124,58,237,0.2)',
                  animation: 'loginOrbit2 1.3s linear infinite reverse',
                  '@keyframes loginOrbit2': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } }
                }} />
                <Box sx={{
                  position: 'absolute', inset: 20, borderRadius: '50%',
                  border: '1.5px solid transparent',
                  borderTopColor: '#ec4899',
                  animation: 'loginOrbit3 0.9s linear infinite',
                  '@keyframes loginOrbit3': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } }
                }} />
                <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Box sx={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #1d4ed8 0%, #7c3aed 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: 'loginCorePulse 1.1s ease-in-out infinite alternate',
                    '@keyframes loginCorePulse': {
                      from: { transform: 'scale(0.78)', boxShadow: '0 0 0 0 rgba(29,78,216,0.5)' },
                      to: { transform: 'scale(1.08)', boxShadow: '0 0 0 8px rgba(29,78,216,0)' }
                    }
                  }}>
                    <SchemaIcon sx={{ fontSize: 14, color: '#fff' }} />
                  </Box>
                </Box>
                <Box sx={{
                  position: 'absolute', bottom: -18, left: '50%', transform: 'translateX(-50%)',
                  display: 'flex', gap: '5px', alignItems: 'center'
                }}>
                  {[0, 1, 2, 3].map((i) => (
                    <Box key={i} sx={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #3b82f6, #7c3aed)',
                      animation: 'loginDotBounce 1.2s ease-in-out infinite',
                      animationDelay: `${i * 0.18}s`,
                      '@keyframes loginDotBounce': {
                        '0%, 100%': { transform: 'scaleY(1)', opacity: 0.4 },
                        '50%': { transform: 'scaleY(1.8)', opacity: 1 }
                      }
                    }} />
                  ))}
                </Box>
              </Box>
            </Box>

            <Typography variant="h6" sx={{
              fontFamily: '"Montserrat", "Segoe UI", sans-serif',
              fontWeight: 800,
              fontSize: { xs: '1.5rem', sm: '1.65rem' },
              lineHeight: 1.2,
              color: '#0f172a',
              mb: 0.6,
              letterSpacing: -0.3
            }}>
              Sistemas de Gestión
            </Typography>
            <Typography sx={{
              fontFamily: '"Montserrat", "Segoe UI", sans-serif',
              fontWeight: 700,
              fontSize: { xs: '0.95rem', sm: '1.05rem' },
              color: '#1d4ed8',
              mb: 1.5,
              letterSpacing: 0.8
            }}>
              por Procesos
            </Typography>
            <Typography variant="body2" sx={{
              fontFamily: '"Montserrat", "Segoe UI", sans-serif',
              color: '#64748b',
              fontSize: 13.5,
              lineHeight: 1.6,
              maxWidth: 320,
              mx: 'auto'
            }}>
              Inicia sesión con tu cuenta Google institucional para acceder al sistema.
            </Typography>
          </Box>

          <Divider sx={{
            borderColor: 'rgba(148,163,184,0.2)',
            mb: 3.5,
            '&::before, &::after': { borderColor: 'rgba(148,163,184,0.2)' }
          }}>
            <Typography variant="caption" sx={{
              color: '#94a3b8',
              fontWeight: 600,
              fontSize: 11,
              letterSpacing: 1.5,
              textTransform: 'uppercase'
            }}>
              Acceso institucional
            </Typography>
          </Divider>

          {/* ── Error alert ── */}
          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 3,
                borderRadius: 2.5,
                border: '1px solid rgba(239,68,68,0.2)',
                '& .MuiAlert-icon': { color: '#ef4444' },
                animation: 'shakeIn 0.5s ease-out',
                '@keyframes shakeIn': {
                  '0%': { transform: 'translateX(-8px)', opacity: 0 },
                  '25%': { transform: 'translateX(6px)' },
                  '50%': { transform: 'translateX(-4px)' },
                  '75%': { transform: 'translateX(2px)' },
                  '100%': { transform: 'translateX(0)', opacity: 1 }
                }
              }}
            >
              {error}
            </Alert>
          )}

          {/* ── Google sign-in section ── */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>

            {/* Google SDK button en modo icono para no mostrar correo sugerido */}
            <Box
              ref={googleButtonRef}
              sx={{
                minHeight: 48,
                width: '100%',
                maxWidth: 420,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                p: 1,
                borderRadius: 3,
                transition: 'opacity 0.25s ease',
                opacity: loading ? 0 : 1,
                pointerEvents: loading ? 'none' : 'auto',
                '&:hover': { background: 'rgba(59,130,246,0.04)' },
                '& iframe': { maxWidth: '52px !important' }
              }}
            />

            {/* Estado de carga — se muestra mientras se valida con Google */}
            {loading && (
              <Button
                fullWidth
                variant="contained"
                size="large"
                disabled
                startIcon={<CircularProgress size={18} color="inherit" sx={{ flexShrink: 0 }} />}
                sx={{
                  py: 1.65,
                  borderRadius: 3,
                  textTransform: 'none',
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: 0.2,
                  position: 'relative',
                  overflow: 'hidden',
                  animation: 'btnAuthPulse 1.6s ease-in-out infinite',
                  '@keyframes btnAuthPulse': {
                    '0%, 100%': { boxShadow: '0 8px 30px rgba(29,78,216,0.3)' },
                    '50%': { boxShadow: '0 10px 40px rgba(79,70,229,0.55)' }
                  },
                  '&.Mui-disabled': {
                    background: 'linear-gradient(135deg, #1e40af 0%, #4338ca 50%, #6d28d9 100%)',
                    color: '#fff',
                    opacity: 1
                  },
                  /* Shimmer sweep */
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    top: 0, left: '-60%',
                    width: '60%', height: '100%',
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)',
                    animation: 'btnShimmer 1.4s ease-in-out infinite',
                    '@keyframes btnShimmer': {
                      '0%': { left: '-60%' },
                      '100%': { left: '130%' }
                    }
                  }
                }}
              >
                Iniciando sesión…
              </Button>
            )}

            {/* SDK aún no listo */}
            {!googleReady && !loading && (
              <Button
                fullWidth
                variant="contained"
                size="large"
                disabled
                startIcon={<CircularProgress size={18} color="inherit" />}
                sx={{
                  py: 1.65,
                  borderRadius: 3,
                  textTransform: 'none',
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: 0.2,
                  '&.Mui-disabled': {
                    background: 'linear-gradient(135deg, #1d4ed8 0%, #4f46e5 50%, #7c3aed 100%)',
                    color: '#fff',
                    opacity: 0.8
                  }
                }}
              >
                Preparando acceso seguro…
              </Button>
            )}
          </Box>

          {/* ── Footer ── */}
          <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Divider sx={{ mb: 2, borderColor: 'rgba(148,163,184,0.15)' }} />
            <Typography variant="caption" sx={{
              color: '#94a3b8',
              fontSize: 11,
              fontFamily: '"Montserrat", "Segoe UI", sans-serif',
              lineHeight: 1.8,
              display: 'block'
            }}>
              Universidad CESMAG · Pasto, Nariño
            </Typography>
            <Typography variant="caption" sx={{
              color: '#cbd5e1',
              fontSize: 10.5,
              fontFamily: '"Montserrat", "Segoe UI", sans-serif',
              display: 'block',
              mb: 2
            }}>
              © {new Date().getFullYear()} Sistema de Gestión por Procesos
            </Typography>
            {/* Sello Vigilada MINEDUCACIÓN — tarjeta */}
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <VigiladaMineducacion variant="light" size="sm" />
            </Box>
          </Box>
        </Paper>
      </Container>

      {/* ── Contact Dialog ── */}
      <Dialog
        open={showContactDialog}
        onClose={() => setShowContactDialog(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            overflow: 'hidden',
            boxShadow: '0 25px 65px rgba(0,0,0,0.25)'
          }
        }}
      >
        <DialogTitle sx={{ p: 0 }}>
          <Box sx={{
            p: 3,
            background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
            color: 'white',
            position: 'relative',
            overflow: 'hidden',
            '&::after': {
              content: '""',
              position: 'absolute',
              top: -30, right: -30,
              width: 100, height: 100,
              borderRadius: '50%',
              background: 'rgba(59,130,246,0.15)'
            }
          }}>
            <Typography variant="overline" sx={{ opacity: 0.7, letterSpacing: 2, fontSize: 10 }}>
              Universidad CESMAG
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, fontSize: 18 }}>
              Acceso restringido
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="body2" sx={{ color: '#475569', mb: 2.5, lineHeight: 1.6 }}>
            {getContactCopy(error)}
          </Typography>
          <Box sx={{
            p: 2.5,
            borderRadius: 3,
            bgcolor: '#f0f4ff',
            border: '1px solid #dbeafe',
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              left: 0, top: 0, bottom: 0,
              width: 4,
              background: 'linear-gradient(180deg, #3b82f6, #7c3aed)',
              borderRadius: '4px 0 0 4px'
            }
          }}>
            <Stack spacing={0.8} sx={{ pl: 1 }}>
              <Typography variant="caption" sx={{ color: '#1e40af', fontWeight: 800, letterSpacing: 0.5 }}>
                Contacto administrador
              </Typography>
              <Typography variant="body2" sx={{ color: '#1e293b', fontWeight: 600 }}>
                📞 Teléfono: (602) 7244434 Ext. 1386
              </Typography>
              <Typography variant="body2" sx={{ color: '#1e293b', fontWeight: 600 }}>
                ✉️ Correo: sgc@unicesmag.edu.co
              </Typography>
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={() => setShowContactDialog(false)}
            variant="contained"
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: 2.5,
              px: 4,
              background: 'linear-gradient(135deg, #1d4ed8 0%, #4f46e5 100%)',
              boxShadow: '0 4px 14px rgba(29,78,216,0.3)',
              '&:hover': {
                background: 'linear-gradient(135deg, #1e40af 0%, #4338ca 100%)'
              }
            }}
          >
            Entendido
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
    </>
  );
}

export default Login;
