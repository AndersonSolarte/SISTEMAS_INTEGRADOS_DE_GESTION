import React, { useEffect, useState } from 'react';
import { keyframes } from '@emotion/react';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Typography } from '@mui/material';
import reporteSalidaService from '../../services/reporteSalidaService';

const pendingConsentGlow = keyframes`
  0%, 100% { box-shadow: 0 0 0 2px rgba(211, 47, 47, 0.08); }
  50% { box-shadow: 0 0 0 6px rgba(211, 47, 47, 0.14), 0 0 12px rgba(211, 47, 47, 0.12); }
`;

export default function ConsentimientoSalud({ value, onChange, withoutAttachment = false, noAttachmentDeclaration = '' }) {
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
    if (value?.accepted && (!policy || value.policyHash !== policy.hash || Boolean(value.withoutAttachment) !== withoutAttachment)) onChange(null);
  }, [value, policy, onChange, withoutAttachment]);

  const accepted = Boolean(policy && value?.accepted && value.policyHash === policy.hash && Boolean(value.withoutAttachment) === withoutAttachment);
  return (
    <Box sx={{ border: '1px solid #dbe4ef', borderRadius: 2, bgcolor: '#fff', p: { xs: 1.5, sm: 2 }, boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)' }}>
      {loadError && <Alert severity="error">No se pudo cargar la autorización. <Button onClick={() => setAttempt((previous) => previous + 1)}>Reintentar</Button></Alert>}
      {!policy && !loadError && <Typography role="status">Cargando autorización…</Typography>}
      <FormControlLabel
        sx={{ m: 0, alignItems: 'flex-start', '& .MuiFormControlLabel-label': { fontSize: 13, lineHeight: 1.6, pt: '5px' } }}
        control={<Checkbox
          size="small" required checked={accepted} disabled={!policy} color="primary"
          sx={{
            p: '5px', mr: 0.75, borderRadius: '7px', border: '1px solid',
            borderColor: policy && !accepted ? 'error.main' : 'transparent',
            color: policy && !accepted ? 'error.main' : 'primary.main',
            bgcolor: policy && !accepted ? 'rgba(211, 47, 47, 0.03)' : 'transparent',
            animation: policy && !accepted ? `${pendingConsentGlow} 2.4s ease-in-out infinite` : 'none',
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 3 }
          }}
          inputProps={{ 'aria-invalid': policy && !accepted ? true : undefined, 'aria-describedby': !accepted ? 'consentimiento-salud-requisito' : undefined }}
          onChange={(event) => onChange(event.target.checked ? { accepted: true, version: policy.version, policyHash: policy.hash, withoutAttachment, clientAcceptedAt: new Date().toISOString() } : null)}
        />}
        label={withoutAttachment
          ? 'Autorizo la verificación de soportes y el tratamiento de mis datos personales y sensibles, y acepto la declaración de entrega posterior de soportes.'
          : 'Autorizo la verificación de soportes y el tratamiento de mis datos personales y sensibles.'}
      />
      <Box sx={{ pl: '38px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 1.5, rowGap: 0.5 }}>
        <Button size="small" onClick={() => setExpanded(true)} disabled={!policy} sx={{ p: 0, minWidth: 0, fontSize: 12, fontWeight: 500, textTransform: 'none' }}>Leer autorización</Button>
      </Box>
      {!accepted && <Typography id="consentimiento-salud-requisito" role="alert" color="error" sx={{ pl: '38px', mt: 0.5, fontSize: 12 }}>Debe aceptar la autorización para radicar.</Typography>}
      <Dialog open={expanded} onClose={() => setExpanded(false)} maxWidth="sm" fullWidth aria-labelledby="salud-autorizacion-titulo">
        <DialogTitle id="salud-autorizacion-titulo" sx={{ fontSize: 16, fontWeight: 600 }}>Autorización de Salud y Bienestar</DialogTitle>
        <DialogContent dividers sx={{ '& p': { fontSize: 13, lineHeight: 1.75 } }}>
          {withoutAttachment && <Typography paragraph>{noAttachmentDeclaration}</Typography>}
          {policy?.paragraphs.map((paragraph, index) => <Typography key={index} paragraph>{paragraph}</Typography>)}
          <Typography sx={{ mb: 0 }}>{policy?.declaration}</Typography>
        </DialogContent>
        <DialogActions><Button onClick={() => setExpanded(false)}>Cerrar</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
