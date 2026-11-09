import React, { useEffect, useRef, useState } from 'react';
import { TextField } from '@mui/material';

// Keep keystrokes local instead of rebuilding the complete plan on every key.
// Blur flushes synchronously before Save, Export, or navigation can run.
export default function BufferedTextField({ value, onChange, onBlur, ...props }) {
  const [draft, setDraft] = useState(value ?? '');
  const pending = useRef(null);
  const timer = useRef(null);
  const change = useRef(onChange);
  change.current = onChange;
  const flush = () => {
    clearTimeout(timer.current);
    if (pending.current !== null) {
      const event = pending.current;
      pending.current = null;
      change.current(event);
    }
  };
  useEffect(() => {
    if (pending.current === null) setDraft(value ?? '');
  }, [value]);
  useEffect(() => () => clearTimeout(timer.current), []);
  return <TextField {...props} value={draft} onChange={(event) => {
    const next = event.target.value;
    setDraft(next);
    // React events are not retained across the debounce; consumers need value.
    pending.current = { target: { value: next }, currentTarget: { value: next } };
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 180);
  }} onBlur={(event) => { flush(); onBlur?.(event); }} />;
}
