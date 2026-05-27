import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';

export default function SessionTimeoutModal() {
  const { showSessionTimeoutModal, sessionTimeoutReason, confirmRelogin, cancelSessionTimeout } = useAuth();
  const isIdle = sessionTimeoutReason === 'idle';

  return (
    <Dialog
      open={showSessionTimeoutModal}
      onClose={isIdle ? cancelSessionTimeout : confirmRelogin}
      maxWidth="xs"
      fullWidth
      disableEscapeKeyDown
    >
      <DialogTitle>La sesion expiro</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {isIdle
            ? 'Su sesion ha excedido el tiempo limite por inactividad. Puede continuar si sigue trabajando o autenticarse nuevamente.'
            : 'Su sesion alcanzo el tiempo maximo permitido. Por favor, acceda de nuevo.'}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {isIdle && (
          <Button onClick={cancelSessionTimeout} color="inherit">
            Cancelar
          </Button>
        )}
        <Button onClick={confirmRelogin} variant="contained" color="primary" autoFocus>
          Autenticarse nuevamente
        </Button>
      </DialogActions>
    </Dialog>
  );
}
