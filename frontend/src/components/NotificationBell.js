import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  IconButton, Badge, Popover, Box, Typography, Stack,
  List, ListItem, ListItemAvatar, ListItemText, Avatar,
  Button, Divider, Tooltip, CircularProgress
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  NotificationsNone as NotificationsNoneIcon,
  RateReview as RateReviewIcon,
  CheckCircle as CheckCircleIcon,
  AssignmentTurnedIn as AssignmentTurnedInIcon,
  DoneAll as DoneAllIcon,
  OpenInNew as OpenInNewIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import strategicPlanningService from '../services/strategicPlanningService';

const formatRelativeTime = (dateInput) => {
  if (!dateInput) return '';
  const now = new Date();
  const date = new Date(dateInput);
  const diffSec = Math.floor((now - date) / 1000);
  if (diffSec < 60) return 'Hace un momento';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Hace ${diffMin} ${diffMin === 1 ? 'minuto' : 'minutos'}`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
};

const getNotificationIcon = (type) => {
  switch (type) {
    case 'action_plan_adjustments':
      return {
        icon: <RateReviewIcon sx={{ fontSize: 18 }} />,
        bgcolor: '#fef3c7',
        color: '#b45309'
      };
    case 'action_plan_review_submitted':
      return {
        icon: <AssignmentTurnedInIcon sx={{ fontSize: 18 }} />,
        bgcolor: '#dbeafe',
        color: '#1d4ed8'
      };
    case 'action_plan_activated':
      return {
        icon: <CheckCircleIcon sx={{ fontSize: 18 }} />,
        bgcolor: '#dcfce7',
        color: '#15803d'
      };
    default:
      return {
        icon: <NotificationsIcon sx={{ fontSize: 18 }} />,
        bgcolor: '#f1f5f9',
        color: '#475569'
      };
  }
};

const NotificationBell = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const intervalRef = useRef(null);

  const fetchNotifications = useCallback(async (isSilent = true) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await strategicPlanningService.getNotifications();
      const payload = res?.data || res || {};
      setNotifications(Array.isArray(payload.notifications) ? payload.notifications : []);
      setUnreadCount(Number(payload.unreadCount || 0));
    } catch {
      // Silencioso para no interrumpir navegación en caso de error de red
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications(false);
    intervalRef.current = setInterval(() => {
      fetchNotifications(true);
    }, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchNotifications]);

  const handleOpen = (e) => {
    setAnchorEl(e.currentTarget);
    fetchNotifications(true);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.read) {
      try {
        await strategicPlanningService.markNotificationRead(notif.id);
        setNotifications((prev) => prev.map((item) => (item.id === notif.id ? { ...item, read: true } : item)));
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // Fallback no crítico
      }
    }
    handleClose();

    const planId = notif.action_plan_id || notif.metadata?.action_plan_id || notif.metadata?.plan_id;
    const isChat = notif.type === 'action_plan_chat_message';
    const isAdj = notif.type === 'action_plan_adjustments';

    // ÚNICAMENTE el analista de Planeación y Efectividad (Luisa Fernanda) va a la plataforma global institucional.
    // Todos los líderes de dependencias (incluyendo administradores, directores y docentes) van a su propio plan de acción.
    const isInstitutionalPlanner = user?.role === 'planeacion_efectividad';

    const params = new URLSearchParams();
    if (planId) params.set('planId', planId);
    if (isChat || isAdj) params.set('openChat', 'true');
    const q = params.toString();

    if (isInstitutionalPlanner) {
      navigate(`/dashboard/planeacion-efectividad${q ? `?${q}` : ''}`);
    } else {
      navigate(`/dashboard/plan-accion-mi-plan${q ? `?${q}` : ''}`);
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await strategicPlanningService.markAllNotificationsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
      setUnreadCount(0);
    } catch {
      // Ignorar
    } finally {
      setMarkingAll(false);
    }
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <Tooltip title={unreadCount > 0 ? `${unreadCount} notificaciones nuevas` : 'Notificaciones'}>
        <IconButton
          onClick={handleOpen}
          size="small"
          sx={{
            color: unreadCount > 0 ? '#2563eb' : '#64748b',
            bgcolor: unreadCount > 0 ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
            '&:hover': {
              bgcolor: unreadCount > 0 ? 'rgba(37, 99, 235, 0.15)' : 'rgba(0, 0, 0, 0.04)',
              transform: 'scale(1.05)'
            },
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <Badge
            badgeContent={unreadCount}
            color="error"
            max={99}
            sx={{
              '& .MuiBadge-badge': {
                fontSize: '0.72rem',
                height: 18,
                minWidth: 18,
                fontWeight: 900,
                boxShadow: '0 0 0 2px #ffffff'
              }
            }}
          >
            <NotificationsIcon fontSize="small" />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            width: { xs: 340, sm: 400 },
            maxHeight: 520,
            borderRadius: 3.5,
            boxShadow: '0 16px 40px -8px rgba(15, 23, 42, 0.18)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
      >
        {/* ENCABEZADO */}
        <Box
          sx={{
            p: 2,
            bgcolor: '#ffffff',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle1" sx={{ fontWeight: 900, color: '#0f172a', fontSize: 16 }}>
              Notificaciones
            </Typography>
            {unreadCount > 0 && (
              <Box
                sx={{
                  bgcolor: '#fee2e2',
                  color: '#dc2626',
                  fontSize: 11,
                  fontWeight: 900,
                  px: 1,
                  py: 0.2,
                  borderRadius: 5
                }}
              >
                {unreadCount} nuevas
              </Box>
            )}
          </Stack>
          {unreadCount > 0 && (
            <Button
              size="small"
              onClick={handleMarkAllRead}
              disabled={markingAll}
              startIcon={<DoneAllIcon sx={{ fontSize: 16 }} />}
              sx={{
                textTransform: 'none',
                fontWeight: 750,
                fontSize: 12,
                color: '#2563eb',
                p: '2px 8px',
                borderRadius: 2,
                '&:hover': { bgcolor: '#eff6ff' }
              }}
            >
              Marcar leídas
            </Button>
          )}
        </Box>

        {/* LISTADO DE NOTIFICACIONES */}
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {loading && notifications.length === 0 ? (
            <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={28} />
            </Box>
          ) : notifications.length === 0 ? (
            <Box sx={{ py: 6, px: 3, textAlign: 'center' }}>
              <Box
                sx={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  bgcolor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'grid',
                  placeItems: 'center',
                  mx: 'auto',
                  mb: 1.5,
                  color: '#94a3b8'
                }}
              >
                <NotificationsNoneIcon sx={{ fontSize: 28 }} />
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 800, color: '#334155', mb: 0.5 }}>
                No tienes notificaciones
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block' }}>
                Te avisaremos aquí cuando un líder retroalimente o haya movimientos en tus Planes de Acción.
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {notifications.map((notif, index) => {
                const iconConfig = getNotificationIcon(notif.type);
                return (
                  <React.Fragment key={notif.id || index}>
                    <ListItem
                      onClick={() => handleNotificationClick(notif)}
                      sx={{
                        p: 1.75,
                        cursor: 'pointer',
                        bgcolor: notif.read ? '#ffffff' : '#f8fbff',
                        borderLeft: notif.read ? '3px solid transparent' : '3px solid #2563eb',
                        transition: 'background-color 0.15s ease',
                        '&:hover': {
                          bgcolor: notif.read ? '#f8fafc' : '#f0f7ff'
                        }
                      }}
                    >
                      <ListItemAvatar sx={{ minWidth: 44 }}>
                        <Avatar
                          sx={{
                            width: 36,
                            height: 36,
                            bgcolor: iconConfig.bgcolor,
                            color: iconConfig.color
                          }}
                        >
                          {iconConfig.icon}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        disableTypography
                        primary={
                          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                            <Typography
                              sx={{
                                fontSize: 13.5,
                                fontWeight: notif.read ? 700 : 900,
                                color: notif.read ? '#1e293b' : '#0f172a',
                                lineHeight: 1.3
                              }}
                            >
                              {notif.title}
                            </Typography>
                            {!notif.read && (
                              <Box
                                sx={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  bgcolor: '#2563eb',
                                  flexShrink: 0,
                                  mt: 0.5
                                }}
                              />
                            )}
                          </Stack>
                        }
                        secondary={
                          <Box sx={{ mt: 0.4 }}>
                            <Typography
                              sx={{
                                fontSize: 12.5,
                                color: '#475569',
                                lineHeight: 1.45,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              }}
                            >
                              {notif.message}
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.6 }}>
                              <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: 11, fontWeight: 600 }}>
                                {formatRelativeTime(notif.created_at)}
                              </Typography>
                              {notif.link && (
                                <Stack direction="row" spacing={0.3} alignItems="center" sx={{ color: '#2563eb', fontSize: 11, fontWeight: 700 }}>
                                  <span>Ver detalle</span>
                                  <OpenInNewIcon sx={{ fontSize: 11 }} />
                                </Stack>
                              )}
                            </Stack>
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < notifications.length - 1 && <Divider component="li" sx={{ borderColor: '#f1f5f9' }} />}
                  </React.Fragment>
                );
              })}
            </List>
          )}
        </Box>

        {/* PIE */}
        <Box
          sx={{
            py: 1,
            px: 2,
            bgcolor: '#f8fafc',
            borderTop: '1px solid #f1f5f9',
            textAlign: 'center'
          }}
        >
          <Typography variant="caption" sx={{ color: '#64748b', fontSize: 11, fontWeight: 600 }}>
            Módulo Institucional: Planes de Acción Estratégicos
          </Typography>
        </Box>
      </Popover>
    </>
  );
};

export default NotificationBell;
