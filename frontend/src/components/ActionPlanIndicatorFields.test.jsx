import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ActionPlanIndicatorFields, { resolveIndicatorValues } from './ActionPlanIndicatorFields';

function Form({ initial = {} }) {
  const [values, setValues] = useState({
    indicadorResultadoActivo: true,
    indicadorLogroActivo: true,
    indicadorImpactoActivo: true,
    ...initial
  });

  return (
    <ActionPlanIndicatorFields
      values={values}
      onChange={(changes) => setValues((prev) => ({ ...prev, ...changes }))}
    />
  );
}

test('ActionPlanIndicatorFields renders result, achievement, and impact without date fields', () => {
  render(<Form />);
  const result = screen.getByRole('textbox', { name: 'Indicador de resultado' });
  const achievement = screen.getByRole('textbox', { name: 'Indicador de logro' });
  const impact = screen.getByRole('textbox', { name: 'Indicador de impacto' });

  expect(result).toBeInTheDocument();
  expect(achievement).toBeInTheDocument();
  expect(impact).toBeInTheDocument();

  // Ensure NO date inputs exist
  expect(screen.queryByLabelText(/fecha/i)).not.toBeInTheDocument();

  fireEvent.change(result, { target: { value: 'Número de estudiantes matriculados' } });
  fireEvent.change(achievement, { target: { value: 'Capacitación al 100%' } });
  fireEvent.change(impact, { target: { value: 'Mejora en la tasa de graduación' } });

  expect(result).toHaveValue('Número de estudiantes matriculados');
  expect(achievement).toHaveValue('Capacitación al 100%');
  expect(impact).toHaveValue('Mejora en la tasa de graduación');
});

test('allows editing targets independently', () => {
  render(<Form />);
  const metaRes = screen.getByRole('textbox', { name: 'Meta de resultado' });
  const metaLog = screen.getByRole('textbox', { name: 'Meta de logro' });
  const metaImp = screen.getByRole('textbox', { name: 'Meta de impacto' });

  fireEvent.change(metaRes, { target: { value: '500 inscritos' } });
  fireEvent.change(metaLog, { target: { value: '100%' } });
  fireEvent.change(metaImp, { target: { value: 'Incremento del 15%' } });

  expect(metaRes).toHaveValue('500 inscritos');
  expect(metaLog).toHaveValue('100%');
  expect(metaImp).toHaveValue('Incremento del 15%');
});

test('resolveIndicatorValues handles legacy indicator and target fields', () => {
  const resolved = resolveIndicatorValues({
    indicador: 'Indicador general',
    meta: '80%'
  });
  expect(resolved.indicadorResultado).toBe('Indicador general');
  expect(resolved.metaResultado).toBe('80%');
  expect(resolved.indicadorResultadoActivo).toBe(true);
});

test('allows removing an indicator via the trash button', () => {
  render(<Form initial={{ indicadorResultadoActivo: true, indicadorLogroActivo: false, indicadorImpactoActivo: false }} />);
  expect(screen.getByRole('textbox', { name: 'Indicador de resultado' })).toBeInTheDocument();

  const removeBtn = screen.getByRole('button', { name: 'Quitar indicador de resultado' });
  fireEvent.click(removeBtn);

  expect(screen.queryByRole('textbox', { name: 'Indicador de resultado' })).not.toBeInTheDocument();
  expect(screen.getByText(/No hay indicadores agregados aún/i)).toBeInTheDocument();
});
