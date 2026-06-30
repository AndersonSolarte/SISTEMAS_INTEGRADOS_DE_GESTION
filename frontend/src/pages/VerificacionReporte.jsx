import React, { useEffect, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Paper,
  CircularProgress,
  Stack,
  Button,
  Divider,
  Alert
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import api from '../services/api';

const formatDateTime = (value) => {
  if (!value) return 'Pendiente';
  const dateObj = new Date(value);
  if (Number.isNaN(dateObj.getTime())) return value;
  return dateObj.toLocaleString('es-CO');
};

const VerificacionReporte = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await api.get(`/reporte-salida/public/verificar/${id}`);
        setData(response.data.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Documento no encontrado o no válido.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f1f5f9', py: 8 }}>
      <Container maxWidth="sm">
        <Paper elevation={0} sx={{ p: { xs: 3, sm: 5 }, borderRadius: 4, textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
          {error ? (
            <>
              <CancelIcon color="error" sx={{ fontSize: 80, mb: 2 }} />
              <Typography variant="h5" fontWeight="700" color="error" gutterBottom>
                Verificación Fallida
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 4 }}>
                {error}
              </Typography>
            </>
          ) : (
            <>
              <CheckCircleIcon color="success" sx={{ fontSize: 80, mb: 2 }} />
              <Typography variant="h5" fontWeight="700" color="success.main" gutterBottom>
                Documento Auténtico
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 4 }}>
                Los datos impresos deben coincidir exactamente con la información listada a continuación:
              </Typography>
              
              <Alert severity="info" sx={{ textAlign: 'left', mb: 3 }}>
                <strong>ID Transacción:</strong> {data.tx_id || data.id}
              </Alert>

              <Stack spacing={2} divider={<Divider />} sx={{ textAlign: 'left', mb: 4 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight="700">SOLICITANTE</Typography>
                  <Typography variant="body1">{data.solicitante.nombre}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Doc: {data.solicitante.documento} | Cargo: {data.solicitante.cargo}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Dependencia: {data.solicitante.dependencia}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight="700">FECHA RADICACIÓN</Typography>
                  <Typography variant="body1">{formatDateTime(data.createdAt)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight="700">APROBACIÓN JEFE</Typography>
                  <Typography variant="body1">{formatDateTime(data.jefe_aprobado_at)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight="700">RECIBIDO GESTIÓN HUMANA</Typography>
                  <Typography variant="body1">{formatDateTime(data.gestion_humana_aprobado_at)}</Typography>
                </Box>
              </Stack>
            </>
          )}

          <Button 
            component={RouterLink} 
            to="/" 
            variant="outlined" 
            fullWidth 
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, py: 1.5 }}
          >
            Ir a la plataforma principal
          </Button>
        </Paper>
      </Container>
    </Box>
  );
};

export default VerificacionReporte;
