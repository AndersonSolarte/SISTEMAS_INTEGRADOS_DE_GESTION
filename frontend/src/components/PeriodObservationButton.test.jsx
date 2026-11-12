import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import PeriodObservationButton from './PeriodObservationButton';
import { periodObservation } from '../utils/periodObservation';

const s1 = { id: 'p1', code: 'S1', name: 'Seguimiento 1', position: 1 };
const s2 = { id: 'p2', code: 'S2', name: 'Seguimiento 2 / Cierre', position: 2 };
const activity = { id: 'a', code: 'ACT-001', activity: 'Revisar documentos', monitoringResults: [
  { monitoring_period_id: 'p1', physical_progress: 100, observations: 'Soportes de S1 completos.' },
  { monitoring_period_id: 'p2', physical_progress: 0, observations: 'Corregir soportes de S2.' }
] };

test('shows the official observation for the selected activity and cut, including a zero-progress period', () => {
  render(<><PeriodObservationButton activity={activity} period={s1} /><PeriodObservationButton activity={activity} period={s2} /></>);
  fireEvent.click(screen.getByRole('button', { name: 'Observaciones S2 de ACT-001' }));
  const dialog = within(screen.getByRole('dialog'));
  expect(dialog.getByText('Corregir soportes de S2.')).toBeInTheDocument();
  expect(dialog.queryByText('Soportes de S1 completos.')).not.toBeInTheDocument();
  expect(dialog.getByText('S2 · Seguimiento 2 / Cierre')).toBeInTheDocument();
  expect(dialog.queryByRole('button', { name: 'Editar valoración' })).not.toBeInTheDocument();
});

test('does not display the observations of another activity', () => {
  render(<PeriodObservationButton activity={{ ...activity, code: 'ACT-002', monitoringResults: [] }} period={s1} />);
  fireEvent.click(screen.getByRole('button', { name: 'Observaciones S1 de ACT-002' }));
  expect(screen.getByText('No hay observaciones registradas para esta actividad en este corte.')).toBeInTheDocument();
  expect(screen.queryByText('Soportes de S1 completos.')).not.toBeInTheDocument();
});

test('planning can open the existing valuation for editing the selected cut', () => {
  const edit = jest.fn();
  render(<PeriodObservationButton activity={activity} period={s2} onEdit={edit} />);
  fireEvent.click(screen.getByRole('button', { name: 'Observaciones S2 de ACT-001' }));
  fireEvent.click(screen.getByRole('button', { name: 'Editar valoración' }));
  expect(edit).toHaveBeenCalledTimes(1);
});

test('planning opens a blank cut directly for entering its concept', () => {
  const edit = jest.fn();
  render(<PeriodObservationButton activity={{ ...activity, monitoringResults: [] }} period={s2} onEdit={edit} />);
  fireEvent.click(screen.getByRole('button', { name: 'Observaciones S2 de ACT-001' }));
  expect(edit).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('a saved blank does not restore a historical concept or borrow the other cut', () => {
  const item = { ...activity, custom_values: { observations_s2: 'Concepto anterior' }, monitoringResults: [
    activity.monitoringResults[0], { monitoring_period_id: 'p2', observations: '' }
  ] };
  expect(periodObservation(item, s2)).toBe('');
  expect(periodObservation(item, s1)).toBe('Soportes de S1 completos.');
});

test('historical observations use the explicit cut code and never the table index', () => {
  const item = { custom_values: { observations_s1: 'Primer corte', observations_s2: 'Segundo corte' } };
  expect(periodObservation(item, { ...s2, position: 1 })).toBe('Segundo corte');
  expect(periodObservation(item, { id: 'p3', position: 3 })).toBe('');
  expect(periodObservation(item, null)).toBe('');
});

test('does not confuse period IDs or show a deleted valuation', () => {
  const item = { monitoringResults: [
    { monitoring_period_id: 42, observations: 'Vigente' },
    { monitoring_period_id: 'p2', observations: 'Retirada', deleted_at: '2026-11-12' }
  ] };
  expect(periodObservation(item, { id: '42' })).toBe('Vigente');
  expect(periodObservation(item, s2)).toBe('');
});
