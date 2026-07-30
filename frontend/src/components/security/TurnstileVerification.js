import React, { useEffect, useRef } from 'react';
import { Box } from '@mui/material';

const TURNSTILE_SCRIPT_ID = 'cloudflare-turnstile-script';
const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';
let turnstileScriptPromise;

const loadTurnstile = () => {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (turnstileScriptPromise) return turnstileScriptPromise;
  turnstileScriptPromise = new Promise((resolve, reject) => {
    const ready = () => window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile no está disponible'));
    const existing = document.getElementById(TURNSTILE_SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', ready, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = ready;
    script.onerror = () => {
      script.remove();
      reject(new Error('No se pudo cargar Turnstile'));
    };
    document.head.appendChild(script);
  }).catch((error) => {
    turnstileScriptPromise = undefined;
    throw error;
  });
  return turnstileScriptPromise;
};

function TurnstileVerification({ active = true, action, appearance = 'always', size = 'flexible', onVerify, onExpire, onError, sx }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const callbacksRef = useRef({ onVerify, onExpire, onError });
  const siteKey = process.env.REACT_APP_TURNSTILE_SITE_KEY
    || (process.env.NODE_ENV !== 'production' ? TURNSTILE_TEST_SITE_KEY : '');

  useEffect(() => { callbacksRef.current = { onVerify, onExpire, onError }; }, [onVerify, onExpire, onError]);

  useEffect(() => {
    if (!active) return undefined;
    let disposed = false;
    if (!siteKey) {
      callbacksRef.current.onError?.('Turnstile no está configurado para producción.');
      return undefined;
    }
    loadTurnstile()
      .then((turnstile) => {
        if (disposed || !containerRef.current) return;
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          theme: 'light',
          size,
          appearance,
          callback: (token) => callbacksRef.current.onVerify?.(token),
          'expired-callback': () => callbacksRef.current.onExpire?.(),
          'timeout-callback': () => callbacksRef.current.onExpire?.(),
          'error-callback': (errorCode) => {
            const diagnostic = process.env.NODE_ENV !== 'production' && errorCode
              ? ` Código de diagnóstico: ${errorCode}.`
              : '';
            callbacksRef.current.onError?.(`No se pudo completar la verificación de seguridad.${diagnostic}`);
          }
        });
      })
      .catch(() => callbacksRef.current.onError?.('No se pudo cargar la verificación de seguridad.'));
    return () => {
      disposed = true;
      if (window.turnstile && widgetIdRef.current !== null) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [active, action, appearance, siteKey, size]);

  return <Box ref={containerRef} sx={{ minHeight: appearance === 'interaction-only' ? 0 : 65, width: '100%', ...sx }} />;
}

export default TurnstileVerification;
