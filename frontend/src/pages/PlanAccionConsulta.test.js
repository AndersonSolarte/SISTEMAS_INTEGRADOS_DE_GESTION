import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PlanAccionConsulta from './PlanAccionConsulta';
import strategicPlanningService from '../services/strategicPlanningService';
const mockEnqueue = jest.fn();
jest.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: mockEnqueue }) }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 10, role: 'consulta' } }) }));
jest.mock('../services/strategicPlanningService', () => ({ getMyActionPlans: jest.fn(), getActionPlan: jest.fn() }));
jest.mock('../services/planAccionWorkflowService', () => ({ __esModule: true, default: { listarPendientes: jest.fn().mockResolvedValue({ data: [] }) }, ESTADOS_WORKFLOW: {} }));
const plans = ['a', 'b'].map((id, i) => ({ id, code: `2026-R${i + 1}`, title: `Plan ${id}`, status: 'active', is_within_schedule: true,
  term: { year: 2026, status: 'active', starts_on: '2000-01-01', ends_on: '2099-12-31', monitoringPeriods: [] },
  organizationalUnit: { name: `Dependencia ${id}` }, items: [], meetings: [], metadata: {} }));
const show = (path = '/dashboard/plan-accion-mi-plan') => render(<MemoryRouter initialEntries={[path]}><PlanAccionConsulta /></MemoryRouter>);
beforeEach(() => { strategicPlanningService.getMyActionPlans.mockResolvedValue({ data: plans }); });
afterEach(() => { jest.restoreAllMocks(); jest.clearAllMocks(); });
test('shows both plans and allows returning to the list after opening one', async () => {
  show();
  const openButtons = await screen.findAllByRole('button', { name: 'Gestionar Plan y Evidencias' });
  expect(openButtons).toHaveLength(2);
  fireEvent.click(openButtons[1]);
  expect(await screen.findByLabelText('Cambiar de plan')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Volver a Mis Planes' }));
  await waitFor(() => expect(screen.getAllByRole('button', { name: 'Gestionar Plan y Evidencias' })).toHaveLength(2));
  expect(strategicPlanningService.getMyActionPlans).toHaveBeenCalledTimes(1);
});
test('a notification opens its plan but does not trap the user there', async () => {
  show('/dashboard/plan-accion-mi-plan?planId=a');
  expect(await screen.findByRole('button', { name: 'Volver a Mis Planes' })).toBeTruthy();
  const selector = screen.getByLabelText('Cambiar de plan');
  jest.spyOn(selector.parentElement, 'getBoundingClientRect').mockReturnValue({ x: 100, y: 100, left: 100, top: 100, right: 350, bottom: 140, width: 250, height: 40, toJSON: () => ({}) });
  fireEvent.mouseDown(selector);
  fireEvent.click(await screen.findByRole('option', { name: '2026-R2 - Dependencia b' }));
  await waitFor(() => expect(screen.getByLabelText('Cambiar de plan')).toHaveTextContent('2026-R2'));
  fireEvent.click(screen.getByRole('button', { name: 'Volver a Mis Planes' }));
  expect(await screen.findAllByRole('button', { name: 'Gestionar Plan y Evidencias' })).toHaveLength(2);
});
test('no available plans preserves the closed-period message', async () => {
  strategicPlanningService.getMyActionPlans.mockResolvedValue({ data: plans.map(p => ({ ...p, is_within_schedule: false })) });
  show();
  expect(await screen.findByText(/Vigencia Cerrada o Fuera de Plazo Oficial/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Gestionar Plan y Evidencias' })).toBeNull();
});

test('an expired notification still lets the user select other available plans', async () => {
  show('/dashboard/plan-accion-mi-plan?planId=expired&openChat=true');
  expect(await screen.findAllByRole('button', { name: 'Gestionar Plan y Evidencias' })).toHaveLength(2);
  expect(strategicPlanningService.getActionPlan).not.toHaveBeenCalled();
});
test('a single plan opens directly and returning to the list does not reopen it', async () => {
  strategicPlanningService.getMyActionPlans.mockResolvedValue({ data: [plans[0]] });
  show();
  fireEvent.click(await screen.findByRole('button', { name: 'Volver a Mis Planes' }));
  expect(await screen.findAllByRole('button', { name: 'Gestionar Plan y Evidencias' })).toHaveLength(1);
  expect(strategicPlanningService.getMyActionPlans).toHaveBeenCalledTimes(1);
});
test('institutional read-only previews remain independent of the personal selection', async () => {
  render(<MemoryRouter><PlanAccionConsulta readOnly initialPlanData={{ ...plans[0], status: 'closed' }} /></MemoryRouter>);
  expect(await screen.findByText(/Modo Lectura/)).toBeTruthy();
  expect(strategicPlanningService.getMyActionPlans).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('Cambiar de plan')).toBeNull();
});
