import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Typography } from '@mui/material';
import reporteSalidaService from '../../services/reporteSalidaService';

export default function ConsentimientoSalud({ value, onChange }) {
  const [policy, setPolicy] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoadError(false);
    reporteSalidaService.getConfig().then((response) => {
      if (!active) return;
      if (!response?.data?.consentimientoSalud?.hash) throw new Error('Autorización no disponible');
      setPolicy(response.data.consentimientoSalud);
    }).catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [attempt]);

  useEffect(() => {
    if (value?.accepted && (!policy || value.policyHash !== policy.hash)) onChange(null);
  }, [value, policy, onChange]);

  const accepted = Boolean(policy && value?.accepted && value.policyHash === policy.hash);
  return (
    <Box sx={{ border: '1px solid', borderColor: accepted ? 'success.main' : 'error.main', borderRadius: 2, p: 2 }}>
      <Typography sx={{ fontWeight: 800 }}>Autorización para permisos de Salud y Bienestar</Typography>
      <Typography variant="body2" sx={{ mt: 1 }}>Lea la autorización completa para la verificación de la información suministrada y el tratamiento de datos personales, incluidos los datos sensibles.</Typography>
      <Button onClick={() => setExpanded(true)} disabled={!policy} sx={{ my: 1 }}>Ver más: leer autorización completa</Button>
      {loadError && <Alert severity="error">No se pudo cargar la autorización. <Button onClick={() => setAttempt((previous) => previous + 1)}>Reintentar</Button></Alert>}
      {!policy && !loadError && <Typography role="status">Cargando autorización…</Typography>}
      <FormControlLabel
        control={<Checkbox required checked={accepted} disabled={!policy} color="primary" inputProps={{ 'aria-describedby': 'consentimiento-salud-requisito' }} onChange={(event) => onChange(event.target.checked ? { accepted: true, version: policy.version, policyHash: policy.hash, clientAcceptedAt: new Date().toISOString() } : null)} />}
        label={policy?.declaration || 'AUTORIZO el tratamiento de mis datos personales, incluidos los datos sensibles en los términos y para las finalidades anteriormente señaladas.'}
      />
      {!accepted && <Typography id="consentimiento-salud-requisito" role="alert" color="error" variant="body2">Falta aceptar esta autorización obligatoria para radicar el permiso de Salud y Bienestar.</Typography>}
      {accepted && <Typography color="success.main" variant="body2">Autorización seleccionada. La fecha y hora de confirmación quedarán registradas al radicar la solicitud.</Typography>}
      <Dialog open={expanded} onClose={() => setExpanded(false)} maxWidth="md" fullWidth aria-labelledby="salud-autorizacion-titulo">
        <DialogTitle id="salud-autorizacion-titulo">{policy?.title}</DialogTitle>
        <DialogContent dividers>
          {policy?.paragraphs.map((paragraph, index) => <Typography key={index} paragraph>{paragraph}</Typography>)}
          <Typography paragraph sx={{ fontWeight: 700 }}>{policy?.declarationTitle}</Typography>
          <Typography paragraph>☐ {policy?.declaration}</Typography>
          {policy?.fields.map((field) => <Typography key={field} paragraph>{field}</Typography>)}
          <Alert severity="info">Al radicar, el sistema registra la aceptación con su cuenta institucional, nombre, documento, fecha y hora de Colombia y un código de integridad.</Alert>
        </DialogContent>
        <DialogActions><Button onClick={() => setExpanded(false)}>Cerrar</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
