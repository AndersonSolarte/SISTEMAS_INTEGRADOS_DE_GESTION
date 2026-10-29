import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import LegalizacionViaticos from './LegalizacionViaticos';
import { getMisLegalizaciones, presentarLegalizacion } from '../services/legalizacionViaticosService';

const mockSnackbar = jest.fn();
const mockNavigate = jest.fn();
jest.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: mockSnackbar }) }));
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
jest.mock('../services/legalizacionViaticosService', () => ({ getMisLegalizaciones: jest.fn(), presentarLegalizacion: jest.fn() }));
jest.mock('../components/viaticos/LegalizacionViaticosFormat', () => function MockFormat({ onValueChange, values }) {
  return <input aria-label="Valor legalizado" value={values.gasto || ''} onChange={(event) => onValueChange('gasto', event.target.value)} />;
});

const row = (id, estado = 'pendiente_legalizacion') => ({
  solicitud: { consecutivo: `VIA-${id}`, datos_viaticos: { lugarVisitar: `Destino ${id}` }, datos_salida: { fecha: '2026-10-20', fechaRegreso: '2026-10-21' }, liquidacion: { totalAnticipo: 100000 } },
  legalizacion: { id, estado, fecha_limite: '2026-10-26', detalles: [{ id: 'gasto', detalle: 'Manutención', valorAnticipo: 100000 }] }
});

beforeEach(() => jest.clearAllMocks());

test('muestra tarjetas solo de pendientes y no ofrece el historial de finalizadas o en revisión', async () => {
  getMisLegalizaciones.mockResolvedValue({ data: [row(1), row(2, 'legalizacion_vencida'), row(3, 'en_revision'), row(4, 'finalizada'), row(5, 'pendiente_habilitacion')] });
  render(<LegalizacionViaticos />);
  expect(await screen.findByRole('button', { name: 'Legalizar VIA-1' })).toBeInTheDocument();
  expect(screen.getAllByRole('article')).toHaveLength(2);
  expect(screen.queryByText('VIA-4')).not.toBeInTheDocument();
  expect(screen.queryByText('VIA-3')).not.toBeInTheDocument();
  expect(screen.queryByText('VIA-5')).not.toBeInTheDocument();
  expect(screen.queryByText('Finalizadas')).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: 'Buscar comisión' }), { target: { value: 'Destino 2' } });
  expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(screen.getByText('Destino 2')).toBeInTheDocument();
});

test('al presentar conserva las otras pendientes y al enviar la última muestra el cierre sin historial', async () => {
  getMisLegalizaciones.mockResolvedValueOnce({ data: [row(1), row(2)] });
  presentarLegalizacion.mockResolvedValue({ success: true, emailSent: true });
  const changed = jest.fn();
  window.addEventListener('legalizacion:updated', changed);
  render(<LegalizacionViaticos />);
  fireEvent.click(await screen.findByRole('button', { name: 'Legalizar VIA-1' }));
  fireEvent.change(screen.getByLabelText('Valor legalizado'), { target: { value: '90000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar al Técnico Contable' }));
  expect(await screen.findByRole('button', { name: 'Legalizar VIA-2' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Legalizar VIA-1' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Legalizar VIA-2' }));
  fireEvent.change(screen.getByLabelText('Valor legalizado'), { target: { value: '80000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar al Técnico Contable' }));
  expect(await screen.findByText('Está al día con sus legalizaciones')).toBeInTheDocument();
  expect(presentarLegalizacion.mock.calls.map(([id]) => id)).toEqual([1, 2]);
  expect(getMisLegalizaciones).toHaveBeenCalledTimes(1);
  expect(changed).toHaveBeenCalled();
  window.removeEventListener('legalizacion:updated', changed);
});

test('una falla de consulta se presenta como error y no como ausencia de pendientes', async () => {
  getMisLegalizaciones.mockRejectedValue(new Error('Servidor no disponible'));
  render(<LegalizacionViaticos />);
  expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  expect(screen.queryByText('Está al día con sus legalizaciones')).not.toBeInTheDocument();
  await waitFor(() => expect(mockSnackbar).toHaveBeenCalled());
});

test('muestra avance de carga y libera la pantalla al confirmar el guardado con correo en cola', async () => {
  getMisLegalizaciones.mockResolvedValueOnce({ data: [row(1)] });
  let finish;
  presentarLegalizacion.mockImplementationOnce((_id, _form, progress) => {
    progress({ loaded: 25, total: 100 });
    return new Promise((resolve) => { finish = resolve; });
  });
  render(<LegalizacionViaticos />);
  fireEvent.click(await screen.findByRole('button', { name: 'Legalizar VIA-1' }));
  fireEvent.change(screen.getByLabelText('Valor legalizado'), { target: { value: '90000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar al Técnico Contable' }));
  expect(screen.getByText('Cargando datos y soportes: 25%')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Enviar al Técnico Contable' })).toBeDisabled();
  await act(async () => finish({ success: true, emailQueued: true }));
  expect(await screen.findByText('Está al día con sus legalizaciones')).toBeInTheDocument();
  expect(getMisLegalizaciones).toHaveBeenCalledTimes(1);
});
