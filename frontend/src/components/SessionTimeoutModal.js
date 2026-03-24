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
  const { showSessionTimeoutModal, confirmRelogin, cancelSessionTimeout } = useAuth();

  return (
    <Dialog
      open={showSessionTimeoutModal}
      onClose={cancelSessionTimeout}
      maxWidth="xs"
      fullWidth
      disableEscapeKeyDown
    >
      <DialogTitle>La sesión expiró</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Su sesión ha excedido el tiempo límite por inactividad. Por favor, acceda de nuevo.
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={cancelSessionTimeout} color="inherit">
          Cancelar
        </Button>
        <Button onClick={confirmRelogin} variant="contained" color="primary" autoFocus>
          Autenticarse nuevamente
        </Button>
      </DialogActions>
    </Dialog>
  );
}
