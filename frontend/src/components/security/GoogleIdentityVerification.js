import React, { useEffect, useRef } from 'react';
import { Box } from '@mui/material';

function GoogleIdentityVerification({ active = true, autoSelect = false, onVerify, onError, sx }) {
  const containerRef = useRef(null);
  const callbacksRef = useRef({ onVerify, onError });
  const autoPromptAttemptedRef = useRef(false);
  const clientId = String(process.env.REACT_APP_GOOGLE_CLIENT_ID || '').trim();

  useEffect(() => {
    callbacksRef.current = { onVerify, onError };
  }, [onVerify, onError]);

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    let retryTimer;

    const renderGoogleButton = () => {
      if (cancelled) return;
      if (!clientId) {
        callbacksRef.current.onError?.('Google institucional no está configurado.');
        return;
      }
      if (!window.google?.accounts?.id) {
        retryTimer = window.setTimeout(renderGoogleButton, 200);
        return;
      }
      if (!containerRef.current) return;
      containerRef.current.innerHTML = '';
      window.google.accounts.id.initialize({
        client_id: clientId,
        auto_select: Boolean(autoSelect),
        button_auto_select: Boolean(autoSelect),
        cancel_on_tap_outside: true,
        use_fedcm_for_button: Boolean(autoSelect),
        callback: (response) => {
          const credential = String(response?.credential || '').trim();
          if (!credential) {
            callbacksRef.current.onError?.('Google no confirmó la identidad.');
            return;
          }
          callbacksRef.current.onVerify?.(credential);
        }
      });
      window.google.accounts.id.renderButton(containerRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        logo_alignment: 'left',
        width: 320
      });
      if (autoSelect && !autoPromptAttemptedRef.current) {
        autoPromptAttemptedRef.current = true;
        window.google.accounts.id.prompt();
      }
    };

    renderGoogleButton();
    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [active, autoSelect, clientId]);

  return <Box ref={containerRef} sx={{ minHeight: 44, display: 'flex', justifyContent: 'center', alignItems: 'center', ...sx }} />;
}

export default GoogleIdentityVerification;
