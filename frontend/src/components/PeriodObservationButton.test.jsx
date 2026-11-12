import React from 'react';
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PeriodObservationButton from './PeriodObservationButton';
import { periodObservation } from '../utils/periodObservation';
import { getIndicatorObservations } from '../utils/actionPlanIndicators';

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
  expect(dialog.queryByRole('button', { name: 'Editar observación' })).not.toBeInTheDocument();
  expect(dialog.queryByRole('button', { name: 'Eliminar observación' })).not.toBeInTheDocument();
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

test('authorized users edit only the concept text without changing scores or the other cut', async () => {
  const save = jest.fn().mockResolvedValue(undefined);
  const original = JSON.stringify(activity);
  render(<PeriodObservationButton activity={activity} period={s2} onSave={save} />);
  fireEvent.click(screen.getByRole('button', { name: 'Observaciones S2 de ACT-001' }));
  fireEvent.click(screen.getByRole('button', { name: 'Editar observación' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Observación oficial' }), { target: { value: 'Concepto corregido S2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar observación' }));
  await waitFor(() => expect(save).toHaveBeenCalledWith('Concepto corregido S2'));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(JSON.stringify(activity)).toBe(original);
});

test('deletion requires confirmation and can be cancelled', async () => {
  const save = jest.fn().mockResolvedValue(undefined);
  render(<PeriodObservationButton activity={activity} period={s1} onSave={save} />);
  fireEvent.click(screen.getByRole('button', { name: 'Observaciones S1 de ACT-001' }));
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar observación' }));
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar observación' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar eliminación' }));
  await waitFor(() => expect(save).toHaveBeenCalledWith(''));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

test('a failed deletion keeps the concept visible with its error', async () => {
  const save = jest.fn().mockRejectedValue({ response: { data: { message: 'No se pudo eliminar' } } });
  render(<PeriodObservationButton activity={activity} period={s1} onSave={save} />);
  fireEvent.click(screen.getByRole('button', { name: 'Observaciones S1 de ACT-001' }));
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar observación' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar eliminación' }));
  expect(await screen.findByText('No se pudo eliminar')).toBeInTheDocument();
  expect(screen.getByText('Soportes de S1 completos.')).toBeInTheDocument();
});

test('an official deletion stays deleted even if another integration sends an older concept', () => {
  const item = { ...activity, indicator: 'Informe', custom_values: { official_observations: { p1: { text: '' } },
    monitoring_indicators: { p1: { principal: { observations: 'Texto anterior', progress: 100 } } } } };
  expect(periodObservation(item, s1)).toBe('');
  expect(getIndicatorObservations(item, s1.id, 'principal')).toBe('');
  expect(periodObservation(item, s2)).toBe('Corregir soportes de S2.');
});
