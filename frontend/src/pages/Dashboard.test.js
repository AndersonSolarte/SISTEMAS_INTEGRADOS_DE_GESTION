import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Dashboard from './Dashboard';
import favoritoService from '../services/favoritoService';
import reporteSalidaService from '../services/reporteSalidaService';
import meetingMinuteService from '../services/meetingMinuteService';

const mockNavigate = jest.fn();
const mockSnackbar = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate, useLocation: () => ({ search: '' }) }));
jest.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: mockSnackbar }) }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 42, nombre: 'Usuario de prueba', role: 'consulta' } }) }));
jest.mock('../services/favoritoService', () => ({ getFavorites: jest.fn(), removeFavorite: jest.fn() }));
jest.mock('../services/reporteSalidaService', () => ({ getConfig: jest.fn() }));
jest.mock('../services/meetingMinuteService', () => ({ getConfig: jest.fn() }));
jest.mock('../components/reporteSalida/ReporteSalidaFormDialog', () => function MockSalida({ documento, user, onClose }) {
  return <div role="dialog" aria-label="Reporte de salida digital"><span>{documento.codigo} — {user.nombre}</span><button onClick={onClose}>Cerrar salida digital</button></div>;
});
jest.mock('../components/meetingMinute/MeetingMinuteFormDialog', () => function MockMeeting({ document, onClose }) {
  return <div role="dialog" aria-label="Acta digital"><span>{document.codigo}</span><button onClick={onClose}>Cerrar acta digital</button></div>;
});

const documents = [
  { id: 1, codigo: 'THM-DP-FR-002', titulo: 'REPORTE DE SALIDA DURANTE LA JORNADA LABORAL' },
  { id: 2, codigo: 'COM-ID-FR-002', titulo: 'REGISTRO DE ASISTENCIA Y REUNIÓN' },
  { id: 3, codigo: 'COM-GD-FR-012', titulo: 'ACTA DE REUNIÓN CONSEJOS Y COMITÉS' },
  { id: 4, codigo: 'OTRO-FR-001', titulo: 'Documento sin formulario' }
].map(doc => ({ ...doc, version: doc.id === 1 ? '4' : '2', autor: 'Autor institucional de prueba', tipoDocumentacion: { nombre: 'Formato' }, link_acceso: 'https://example.invalid/document.pdf' }));

beforeEach(() => {
  jest.clearAllMocks();
  favoritoService.getFavorites.mockResolvedValue({ data: { favoritos: documents.map(documento => ({ documento })) } });
  reporteSalidaService.getConfig.mockResolvedValue({ data: { enabled: true } });
  meetingMinuteService.getConfig.mockResolvedValue({ data: { formats_enabled: { 'COM-ID-FR-002': true, 'COM-GD-FR-012': false } } });
});

test('Favoritos abre el reporte digital con el mismo documento y usuario, sin abandonar la página', async () => {
  render(<Dashboard />);
  fireEvent.click(await screen.findByRole('button', { name: 'Diligenciar reporte de salida' }));
  const dialog = await screen.findByRole('dialog', { name: 'Reporte de salida digital' });
  expect(dialog).toHaveTextContent('THM-DP-FR-002 — Usuario de prueba');
  expect(mockNavigate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar salida digital' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Reporte de salida digital' })).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Diligenciar reporte de salida' })).toBeInTheDocument();
});

test('permite abrir el acta habilitada y oculta el formato de consejos desactivado', async () => {
  render(<Dashboard />);
  fireEvent.click(await screen.findByRole('button', { name: 'Redactar acta de reunión' }));
  expect(await screen.findByRole('dialog', { name: 'Acta digital' })).toHaveTextContent('COM-ID-FR-002');
  expect(screen.queryByRole('button', { name: 'Redactar acta de Consejo o Comité' })).not.toBeInTheDocument();
});

test('el formato de consejos y comités abre su propio formulario cuando está habilitado', async () => {
  meetingMinuteService.getConfig.mockResolvedValue({ data: { formats_enabled: { 'COM-ID-FR-002': false, 'COM-GD-FR-012': true } } });
  render(<Dashboard />);
  fireEvent.click(await screen.findByRole('button', { name: 'Redactar acta de Consejo o Comité' }));
  expect(await screen.findByRole('dialog', { name: 'Acta digital' })).toHaveTextContent('COM-GD-FR-012');
  expect(screen.queryByRole('button', { name: 'Redactar acta de reunión' })).not.toBeInTheDocument();
});

test('no habilita formularios desactivados y mantiene las acciones originales de favoritos', async () => {
  reporteSalidaService.getConfig.mockResolvedValue({ data: { enabled: false, canToggle: true } });
  meetingMinuteService.getConfig.mockResolvedValue({ data: { enabled: false, formats_enabled: {} } });
  render(<Dashboard />);
  await screen.findByText('Documento sin formulario');
  expect(screen.queryByRole('button', { name: 'Diligenciar reporte de salida' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Redactar acta/ })).not.toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Quitar de favoritos' })).toHaveLength(4);
  expect(screen.getAllByRole('button', { name: 'Abrir en búsqueda' })).toHaveLength(4);
});

test('si falla una configuración, conserva el acceso a los otros formatos habilitados', async () => {
  reporteSalidaService.getConfig.mockRejectedValue(new Error('No disponible'));
  meetingMinuteService.getConfig.mockResolvedValue({ data: { enabled: true } });
  render(<Dashboard />);
  expect(await screen.findByRole('button', { name: 'Redactar acta de reunión' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Diligenciar reporte de salida' })).not.toBeInTheDocument();
});

test('la tabla usa el diseño compacto principal y mantiene paginación y acciones accesibles', async () => {
  render(<Dashboard />);
  await screen.findByRole('button', { name: 'Diligenciar reporte de salida' });
  const table = screen.getByRole('table', { name: 'Documentos favoritos' });
  expect(table).toHaveStyle({ tableLayout: 'fixed' });
  expect(within(table).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual([
    'Código', 'Tipo', 'Nombre Documento', 'Autor', 'Fecha Creación', 'Versión', 'Estado', 'Acciones'
  ]);
  expect(within(table).getByRole('columnheader', { name: 'Código' })).toHaveStyle({ color: '#fff' });
  expect(within(table).getByText('v4')).toBeInTheDocument();
  const row = within(table).getByRole('row', { name: /THM-DP-FR-002/ });
  expect(within(row).getAllByRole('button')).toHaveLength(5);
  expect(within(row).getByText(documents[0].titulo)).toHaveAttribute('title', documents[0].titulo);
  // Se verifica la estructura del contenedor de scroll, no una interacción del usuario.
  // eslint-disable-next-line testing-library/no-node-access
  expect(table.parentElement.contains(screen.getByText('Mostrar:'))).toBe(false);
});
