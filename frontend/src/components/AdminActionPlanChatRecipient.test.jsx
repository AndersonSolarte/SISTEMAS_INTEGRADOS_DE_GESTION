import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AdminActionPlanChatRecipient from './AdminActionPlanChatRecipient';

test('administrator sees only planning, without a recipient selector or leader option', () => {
  render(<AdminActionPlanChatRecipient role="administrador" value="leader" leader={{ id: 'leader', name: 'Other Leader' }}
    planningUser={{ role: 'planeacion_efectividad', nombre: 'Luisa' }} planCode="2026-R74" />);
  expect(screen.getByText('Planeación y Efectividad')).toBeTruthy();
  expect(screen.getByText('Luisa')).toBeTruthy();
  expect(screen.getByText('Plan: 2026-R74')).toBeTruthy();
  expect(screen.queryByRole('combobox')).toBeNull();
  expect(screen.queryByText(/Other Leader/)).toBeNull();
});

test('planning can select an existing administrator conversation', () => {
  const onChange = jest.fn();
  render(<AdminActionPlanChatRecipient role="planeacion_efectividad" value="leader" onChange={onChange}
    actorId="planning" leader={{ id: 'leader', name: 'Leader' }} peers={[{ id: 'admin', name: 'Admin' }]} />);
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 200, height: 40, top: 0, left: 0, right: 200, bottom: 40 });
  fireEvent.mouseDown(screen.getByRole('combobox'));
  fireEvent.click(screen.getByRole('option', { name: /Administrador/ }));
  expect(onChange).toHaveBeenCalledWith('administrator:admin');
  jest.restoreAllMocks();
});
