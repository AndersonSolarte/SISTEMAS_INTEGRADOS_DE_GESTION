import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ActivityIndicatorFields from './ActivityIndicatorFields';

function Form({ initial = {} }) {
  const [activity, setActivity] = useState({ indicadorResultadoActivo: true, indicadorLogroActivo: true, indicadorImpactoActivo: true, ...initial });
  return <ActivityIndicatorFields activity={activity} onChange={(field, value) => setActivity((previous) => ({ ...previous, [field]: value }))} />;
}

test('each activity has three text fields that can be authored independently', () => {
  render(<Form />);
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  const result = screen.getByRole('textbox', { name: 'Indicador de resultado' });
  const achievement = screen.getByRole('textbox', { name: 'Indicador de logro' });
  const impact = screen.getByRole('textbox', { name: 'Indicador de impacto' });
  fireEvent.change(result, { target: { value: 'Reportes entregados' } });
  fireEvent.change(achievement, { target: { value: 'Meta alcanzada' } });
  fireEvent.change(impact, { target: { value: 'Cambio institucional' } });
  expect(result).toHaveValue('Reportes entregados');
  expect(achievement).toHaveValue('Meta alcanzada');
  expect(impact).toHaveValue('Cambio institucional');
});

test('preserves the old indicator text and allows clearing it without restoring its old value', () => {
  render(<Form initial={{ indicador: 'Indicador previo' }} />);
  const result = screen.getByRole('textbox', { name: 'Indicador de resultado' });
  expect(result).toHaveValue('Indicador previo');
  fireEvent.change(result, { target: { value: '' } });
  expect(result).toHaveValue('');
});

test('an old Logro indicator is preserved in its own field', () => {
  render(<Form initial={{ indicador: 'Logro anterior', tipoIndicador: 'Logro' }} />);
  expect(screen.getByRole('textbox', { name: 'Indicador de logro' })).toHaveValue('Logro anterior');
  expect(screen.getByRole('textbox', { name: 'Indicador de resultado' })).toHaveValue('');
});

test('each indicator has an independent alphanumeric target', () => {
  render(<Form />);
  for (const [kind, value] of [['resultado', '12 reportes'], ['logro', '90% de cobertura'], ['impacto', 'Nivel A2']]) {
    const field = screen.getByRole('textbox', { name: `Meta de ${kind}` });
    fireEvent.change(field, { target: { value } });
    expect(field).toHaveValue(value);
  }
});

test('moves the legacy target to its indicator and allows clearing it', () => {
  render(<Form initial={{ tipoIndicador: 'Logro', meta: 12 }} />);
  const field = screen.getByRole('textbox', { name: 'Meta de logro' });
  expect(field).toHaveValue('12');
  expect(screen.getByRole('textbox', { name: 'Meta de resultado' })).toHaveValue('');
  fireEvent.change(field, { target: { value: '' } });
  expect(field).toHaveValue('');
});

test('each indicator can be removed and restored independently without losing its information', () => {
  render(<Form initial={{ indicadorResultado: 'Reportes', metaResultado: '12 reportes', fechaEntregaResultado: '2026-12-10' }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Quitar indicador de resultado' }));
  expect(screen.queryByRole('textbox', { name: 'Indicador de resultado' })).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Indicador de logro' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Agregar indicador' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'resultado' }));
  expect(screen.getByRole('textbox', { name: 'Indicador de resultado' })).toHaveValue('Reportes');
  expect(screen.getByRole('textbox', { name: 'Meta de resultado' })).toHaveValue('12 reportes');
  expect(screen.getByLabelText('Fecha de entrega de resultado')).toHaveValue('2026-12-10');
});

test('delivery dates can be scheduled separately per indicator', () => {
  render(<Form />);
  const field = screen.getByLabelText('Fecha de entrega de impacto');
  fireEvent.change(field, { target: { value: '2026-11-30' } });
  expect(field).toHaveValue('2026-11-30');
  expect(screen.getByLabelText('Fecha de entrega de logro')).toHaveValue('');
});

test('new activities start empty and can add only the indicator they need', () => {
  render(<Form initial={{ indicadorResultadoActivo: false, indicadorLogroActivo: false, indicadorImpactoActivo: false }} />);
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Agregar indicador' }));
  expect(screen.getAllByRole('menuitem')).toHaveLength(3);
  fireEvent.click(screen.getByRole('menuitem', { name: 'impacto' }));
  expect(screen.getByRole('textbox', { name: 'Indicador de impacto' })).toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: 'Indicador de resultado' })).not.toBeInTheDocument();
});
