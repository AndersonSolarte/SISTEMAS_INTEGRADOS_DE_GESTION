import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ActivityIndicatorFields from './ActivityIndicatorFields';

function Form({ initial = {} }) {
  const [activity, setActivity] = useState(initial);
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
