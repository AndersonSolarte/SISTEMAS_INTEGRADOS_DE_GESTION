import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ViaticosGestionDashboard from './ViaticosGestionDashboard';
import { getSolicitudesViaticos, getSolicitudViaticos, getEstadisticasViaticos, validarLegalizacion, revisarContabilidadLegalizacion, confirmarAjustesLegalizacion } from '../../services/legalizacionViaticosService';

const mockSnackbar = jest.fn();
jest.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: mockSnackbar }) }));
jest.mock('../../services/legalizacionViaticosService');
jest.mock('./LegalizacionViaticosFormat', () => function MockFormat({ observations, onObservationsChange, editable }) {
  return <input aria-label="Observaciones técnicas" disabled={!editable} value={observations} onChange={event => onObservationsChange(event.target.value)} />;
});

const user = { role: 'administrador' };
const row = { id: 300, consecutivo: 'VIA-300', datos_viaticos: {}, datos_salida: {}, solicitante_snapshot: { nombre: 'Prueba' }, liquidacion: { totalAnticipo: 100000 }, access: { canValidateLegalizacion: true }, legalizacion: { id: 30, estado: 'en_revision', detalles: [] } };

test('el enlace del correo abre la legalización exacta y habilita la validación autorizada', async () => {
  getSolicitudesViaticos.mockResolvedValue({ data: [row] });
  getEstadisticasViaticos.mockResolvedValue({ data: {} });
  getSolicitudViaticos.mockResolvedValue({ data: row });
  render(<ViaticosGestionDashboard user={user} reviewSolicitudId="300" />);
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText('Legalización · VIA-300')).toBeInTheDocument();
  const validate = within(dialog).getByRole('button', { name: 'Validar y remitir a Contabilidad' });
  expect(validate).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Documento SEVEN'), { target: { files: [new File(['%PDF-test'], 'SEVEN.pdf', { type: 'application/pdf' })] } });
  expect(validate).toBeEnabled();
  validarLegalizacion.mockResolvedValue({ message: 'Remitida a Contabilidad.' });
  fireEvent.click(validate);
  expect(screen.queryByText('Confirmar validación técnica')).not.toBeInTheDocument();
  await waitFor(() => expect(validarLegalizacion).toHaveBeenCalled());
  expect(validarLegalizacion.mock.calls[0][1].get('seven').name).toBe('SEVEN.pdf');
  expect(getSolicitudViaticos).toHaveBeenCalledWith('300');
});

test('Contabilidad puede devolver errores con retroalimentación obligatoria', async () => {
  const assigned = { ...row, access: { canReviewAccounting: true }, legalizacion: { ...row.legalizacion, estado: 'en_revision_contabilidad', adjuntos: [{ id: '7', clase: 'seven', originalName: 'SEVEN.pdf' }] } };
  getSolicitudesViaticos.mockResolvedValue({ data: [assigned] });
  getSolicitudViaticos.mockResolvedValue({ data: assigned });
  revisarContabilidadLegalizacion.mockResolvedValue({ message: 'Devuelta al Técnico.' });
  render(<ViaticosGestionDashboard user={{ role: 'consulta', allowedModules: ['vicerrectoria_financiera.viaticos.gestion'] }} reviewSolicitudId="300" />);
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).queryByRole('button', { name: 'Validar y remitir a Contabilidad' })).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Errores en las cuentas asociadas' }));
  expect(revisarContabilidadLegalizacion).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Retroalimentación de Contabilidad'), { target: { value: 'Corregir cuenta 5105.' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Errores en las cuentas asociadas' }));
  await waitFor(() => expect(revisarContabilidadLegalizacion).toHaveBeenCalledWith(30, { decision: 'errores', observaciones: 'Corregir cuenta 5105.' }));
});

test('Ajustes realizados cierra directamente sin editar valores, adjuntar PDF ni remitir otra validación', async () => {
  const returned = { ...row, legalizacion: { ...row.legalizacion, estado: 'devuelta_tecnico', trazabilidad: [{ event: 'contabilidad_observaciones', detail: { observaciones: 'Error cuenta 5105.' } }] } };
  getSolicitudesViaticos.mockResolvedValue({ data: [returned] });
  getEstadisticasViaticos.mockResolvedValue({ data: {} });
  getSolicitudViaticos.mockResolvedValue({ data: returned });
  confirmarAjustesLegalizacion.mockResolvedValue({ message: 'Ajustes realizados.' });
  render(<ViaticosGestionDashboard user={user} reviewSolicitudId="300" />);
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText(/Error cuenta 5105/)).toBeInTheDocument();
  const close = within(dialog).getByRole('button', { name: 'Ajustes realizados' });
  expect(close).toBeEnabled();
  expect(screen.queryByLabelText('Documento SEVEN')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Observaciones técnicas')).toBeDisabled();
  fireEvent.click(close);
  expect(screen.queryByText('Confirmar ajustes y cierre')).not.toBeInTheDocument();
  await waitFor(() => expect(confirmarAjustesLegalizacion).toHaveBeenCalledWith(30));
  expect(validarLegalizacion).not.toHaveBeenCalled();
});

test('la etapa de Tesorería presenta la acción Procesar liquidación para pago', async () => {
  getSolicitudesViaticos.mockResolvedValue({ data: [{ ...row, legalizacion: null, estado: 'pendiente_autorizacion_pago', token_etapa: 'tesoreria', paso_actual: 0, plan_aprobacion: [{ key: 'tesoreria', label: 'Tesorería', action: 'pago' }], access: { canAct: true } }] });
  getEstadisticasViaticos.mockResolvedValue({ data: {} });
  render(<ViaticosGestionDashboard user={user} />);
  expect(await screen.findByRole('button', { name: 'Procesar liquidación para pago' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Autorizar Pago' })).not.toBeInTheDocument();
});

test.each([
  [undefined, 'finalizada'], ['tecnico', 'en_revision_contabilidad'], ['contabilidad', 'devuelta_tecnico'], ['ajustes', 'finalizada']
])('el enlace %s ya atendido muestra Solicitud procesada con estado %s', async (reviewStage, estado) => {
  const processed = { ...row, legalizacion: { ...row.legalizacion, estado } };
  getSolicitudesViaticos.mockResolvedValue({ data: [processed] });
  getEstadisticasViaticos.mockResolvedValue({ data: {} });
  getSolicitudViaticos.mockResolvedValue({ data: processed });
  render(<ViaticosGestionDashboard user={user} reviewSolicitudId="300" reviewStage={reviewStage} />);
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText('Solicitud procesada')).toBeInTheDocument();
  expect(within(dialog).getByText('Esta actuación ya fue atendida. No es necesario volver a procesarla.')).toBeInTheDocument();
  expect(within(dialog).queryByRole('button', { name: /Validar|Información correcta|Registrar ajustes/ })).not.toBeInTheDocument();
});

test('la tabla muestra las nuevas etapas, sus acciones y permite filtrar Contabilidad y finalizadas', async () => {
  const stages = ['en_revision', 'en_revision_contabilidad', 'devuelta_tecnico', 'finalizada'].map((estado, index) => ({
    ...row, id: 501 + index, consecutivo: `FLUJO-${501 + index}`, estado: index === 3 ? 'legalizacion_finalizada' : 'pago_autorizado_pendiente_legalizacion',
    access: { canValidateLegalizacion: true, canReviewAccounting: true },
    legalizacion: { ...row.legalizacion, id: 51 + index, estado, trazabilidad: [{ event: 'contabilidad_observaciones', actor: { nombre: 'Oficina de Contabilidad' }, at: '2026-10-29T13:00:00-05:00' }], adjuntos: [{ clase: 'seven', originalName: 'SEVEN.pdf' }] }
  }));
  getSolicitudesViaticos.mockResolvedValue({ data: stages });
  getEstadisticasViaticos.mockResolvedValue({ data: {} });
  render(<ViaticosGestionDashboard user={user} />);
  expect(await screen.findByRole('button', { name: 'Verificar cuentas' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Revisar legalización' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Ver ajustes pendientes' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Ver legalización' })).toBeInTheDocument();
  expect(screen.getAllByText('SEVEN adjunto')).toHaveLength(4);
  const table = screen.getByRole('table');
  expect(within(table).getAllByRole('row')).toHaveLength(5);
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Pendiente por revisar en' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Oficina de Contabilidad — verificación de cuentas' }));
  expect(within(table).getAllByRole('row')).toHaveLength(2);
  expect(within(table).getByText('FLUJO-502')).toBeInTheDocument();
  expect(within(table).getByText('29/10/2026')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Estado de legalización' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Legalización finalizada' }));
  expect(within(table).getAllByRole('row')).toHaveLength(2);
  expect(within(table).getByText('FLUJO-504')).toBeInTheDocument();
  expect(within(table).queryByRole('button', { name: 'Verificar cuentas' })).not.toBeInTheDocument();
});
