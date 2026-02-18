import React from 'react';
import { Box, Typography, Grid, Card, CardContent, CardActionArea } from '@mui/material';
import { CheckCircle as CheckIcon } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

function Dashboard() {
  const { user } = useAuth();

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>Bienvenido, {user?.nombre}</Typography>
      <Typography variant="body1" color="text.secondary" paragraph>Sistema de Gestión de Calidad</Typography>
      
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={3}>
            <CardActionArea onClick={() => window.location.href = '/dashboard/aseguramiento-calidad'}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2, color: '#1976d2' }}>
                  <CheckIcon sx={{ fontSize: 48 }} />
                </Box>
                <Typography variant="h6" align="center">Aseguramiento de la Calidad</Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Dashboard;