import React from 'react';
import { configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import PlanMejoramiento from './PlanMejoramiento';
import service from '../../../../services/planMejoramientoService';
import gestion from '../../../../services/gestionInformacionService';

jest.mock('../../../../services/planMejoramientoService', () => ({ __esModule: true, default: {
  list: jest.fn(), catalogs: jest.fn(), syncAutoevaluacion: jest.fn(), get: jest.fn(), update: jest.fn(), searchResponsables: jest.fn()
} }));
jest.mock('../../../../services/gestionInformacionService', () => ({ __esModule: true, default: { getAutoevaluacionDashboard: jest.fn() } }));
jest.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: mockSnackbar }) }));
const mockSnackbar = jest.fn();
configure({ asyncUtilTimeout: 5000 });
jest.setTimeout(30000);
beforeEach(() => jest.clearAllMocks());

test('can create several objectives without closing the editor or losing the previous objective', async () => {
  const plan = { id: 1, programa: 'DERECHO', estado: 'borrador', periodo_inicio: 2026, periodo_fin: 2028, contenido: { objetivos: [], presupuesto: [] } };
  service.list.mockResolvedValue([plan]);
  service.catalogs.mockResolvedValue({});
  service.syncAutoevaluacion.mockResolvedValue({});
  service.get.mockResolvedValue(plan);
  service.update.mockResolvedValue(plan);
  gestion.getAutoevaluacionDashboard.mockResolvedValue({ data: { aspectos: [] } });
  render(<PlanMejoramiento />);
  fireEvent.click(await screen.findByRole('button', { name: 'Abrir plan' }));
  fireEvent.click(await screen.findByRole('tab', { name: /Objetivos y actividades/ }));
  fireEvent.click(screen.getByRole('button', { name: /Crear objetivo de mejoramiento/ }));
  expect(screen.getByRole('button', { name: 'Expandir objetivo 1' })).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(screen.getByRole('button', { name: 'Expandir objetivo 1' }));
  const field = screen.getByLabelText('Objetivo');
  fireEvent.change(field, { target: { value: 'Primer objetivo redactado' } });
  fireEvent.blur(field);
  fireEvent.click(screen.getByRole('button', { name: /Crear objetivo de mejoramiento/ }));
  fireEvent.click(screen.getByRole('button', { name: /Crear objetivo de mejoramiento/ }));
  expect(screen.getAllByLabelText('Código')).toHaveLength(3);
  expect(screen.getAllByLabelText('Código').map((input) => input.value)).toEqual(['OPM_01', 'OPM_02', 'OPM_03']);
  expect(screen.getAllByLabelText('Objetivo')[0]).toHaveValue('Primer objetivo redactado');
  fireEvent.keyDown(screen.getAllByRole('dialog')[0], { key: 'Escape', code: 'Escape' });
  await waitFor(() => expect(screen.getByRole('tab', { name: /Objetivos y actividades/ })).toHaveAttribute('aria-selected', 'true'));
  await waitFor(() => expect(service.update).toHaveBeenCalled(), { timeout: 2500 });
  expect(service.update.mock.calls.at(-1)[1].contenido.objetivos).toHaveLength(3);
});

test('aspects assigned directly in Objectives disappear from the list and return when released', async () => {
  const aspects = [
    { id: 20, factor: 'F1', caracteristica: 'C1', aspecto: 'A20. Revisar currículo', indicador: 'Revisiones realizadas', calificacion: 3.5 },
    { id: 21, factor: 'F1', caracteristica: 'C1', aspecto: 'A21. Ajustar currículo', indicador: 'Ajustes realizados', calificacion: 3.7 }
  ];
  const plan = { id: 3, programa: 'DERECHO', estado: 'borrador', periodo_inicio: 2026, periodo_fin: 2028, contenido: { objetivos: [], presupuesto: [], oportunidadesAutoevaluacion: aspects } };
  service.list.mockResolvedValue([plan]);
  service.catalogs.mockResolvedValue({});
  service.syncAutoevaluacion.mockResolvedValue({});
  service.get.mockImplementation(async () => plan);
  service.update.mockImplementation(async (id, payload) => { plan.contenido = payload.contenido; return plan; });
  gestion.getAutoevaluacionDashboard.mockResolvedValue({ data: { aspectos: aspects } });
  render(<PlanMejoramiento />);
  fireEvent.click(await screen.findByRole('button', { name: 'Abrir plan' }));
  fireEvent.click(await screen.findByRole('tab', { name: /Objetivos y actividades/ }));
  fireEvent.click(screen.getByRole('button', { name: /Crear objetivo de mejoramiento/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Expandir objetivo 1' }));
  fireEvent.mouseDown(await screen.findByLabelText('Factor / condición'));
  fireEvent.click(screen.getByRole('option', { name: 'F1', exact: true }));
  fireEvent.mouseDown(await screen.findByLabelText('Característica'));
  fireEvent.click(screen.getByRole('option', { name: 'C1', exact: true }));
  fireEvent.mouseDown(await screen.findByLabelText('Agregar aspectos / hallazgos pendientes'));
  fireEvent.click(screen.getByRole('option', { name: /Agregar todos los aspectos pendientes/ }));
  fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape', code: 'Escape' });
  fireEvent.click(await screen.findByRole('tab', { name: /Lista de mejoramiento/ }));
  expect(screen.getByText('No hay aspectos pendientes de asociación para este programa.')).toBeInTheDocument();
  await waitFor(() => expect(plan.contenido.objetivos[0]?.aspectosAutoevaluacion).toHaveLength(2), { timeout: 3000 });
  fireEvent.click(screen.getByRole('tab', { name: /Objetivos y actividades/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Expandir objetivo 1' }));
  const assignedRow = screen.getByText(aspects[0].aspecto).closest('tr');
  fireEvent.click(within(assignedRow).getByRole('button'));
  fireEvent.click(screen.getByRole('tab', { name: /Lista de mejoramiento/ }));
  expect(screen.getByText(aspects[0].aspecto)).toBeInTheDocument();
  expect(screen.queryByText(aspects[1].aspecto)).not.toBeInTheDocument();
});

test('associating aspects drains the pending list and stays empty after reopening the saved plan', async () => {
  const aspects = [
    { id: 10, factor: 'F1', caracteristica: 'C1', aspecto: 'A1. Revisar el programa', indicador: 'Reportes realizados', calificacion: 3.5 },
    { id: 11, factor: 'F1', caracteristica: 'C1', aspecto: 'A2. Mejorar el programa', indicador: 'Resultados obtenidos', calificacion: 3.7 }
  ];
  const plan = { id: 2, programa: 'DERECHO', estado: 'borrador', periodo_inicio: 2026, periodo_fin: 2028, contenido: { objetivos: [], presupuesto: [], oportunidadesAutoevaluacion: aspects } };
  service.list.mockResolvedValue([plan]);
  service.catalogs.mockResolvedValue({});
  service.syncAutoevaluacion.mockResolvedValue({});
  service.get.mockImplementation(async () => plan);
  service.update.mockImplementation(async (id, payload) => { plan.contenido = payload.contenido; return plan; });
  gestion.getAutoevaluacionDashboard.mockResolvedValue({ data: { aspectos: aspects } });
  render(<PlanMejoramiento />);
  fireEvent.click(await screen.findByRole('button', { name: 'Abrir plan' }));
  fireEvent.click(await screen.findByRole('tab', { name: /Lista de mejoramiento/ }));
  const firstRow = await screen.findByText(aspects[0].aspecto);
  fireEvent.click(within(firstRow.closest('tr')).getByRole('button', { name: 'Asociar con objetivo' }));
  fireEvent.change(screen.getByLabelText('Objetivo'), { target: { value: 'Mejorar la calidad del programa' } });
  fireEvent.click(screen.getByRole('button', { name: 'Crear y asociar' }));
  await waitFor(() => expect(screen.queryByText(aspects[0].aspecto)).not.toBeInTheDocument());
  expect(screen.getByText(aspects[1].aspecto)).toBeInTheDocument();
  fireEvent.click(await screen.findByRole('button', { name: 'Asociar con objetivo' }));
  fireEvent.mouseDown(screen.getByLabelText('Objetivo de destino'));
  fireEvent.click(screen.getByRole('option', { name: 'Objetivo de mejoramiento 1', exact: true }));
  fireEvent.click(await screen.findByRole('button', { name: 'Confirmar asociación' }));
  await waitFor(() => expect(screen.getByText('No hay aspectos pendientes de asociación para este programa.')).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Asociar con objetivo' })).not.toBeInTheDocument();
  await waitFor(() => expect(plan.contenido.objetivos[0]?.aspectosAutoevaluacion).toHaveLength(2), { timeout: 3000 });
  expect(plan.contenido.objetivos[0].actividades[0].indicadorResultadoActivo).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Planes de mejoramiento' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Abrir plan' }));
  fireEvent.click(await screen.findByRole('tab', { name: /Lista de mejoramiento/ }));
  await waitFor(() => expect(screen.getByText('No hay aspectos pendientes de asociación para este programa.')).toBeInTheDocument());
});
