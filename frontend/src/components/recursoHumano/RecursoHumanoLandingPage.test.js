import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import RecursoHumanoLandingPage from './RecursoHumanoLandingPage';
import reporteSalidaService from '../../services/reporteSalidaService';

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: {}, isAdmin: () => true })
}));
jest.mock('../../services/reporteSalidaService', () => ({
  getSeguimientoBadge: jest.fn(), getSeguimiento: jest.fn(), getConfig: jest.fn()
}));
jest.mock('./RecursoHumanoDashboard', () => () => <div>Tablero profesores abierto</div>);
jest.mock('./AdminDirectivosDashboard', () => () => <div>Tablero administrativos abierto</div>);
jest.mock('../reporteSalida/ReporteSalidaSeguimiento', () => () => <div>Seguimiento abierto</div>);

beforeEach(() => jest.clearAllMocks());

test('muestra el acceso autorizado sin consultar solicitudes ni configuracion', async () => {
  reporteSalidaService.getSeguimientoBadge.mockResolvedValue({ data: { access: { canView: true } } });
  render(<RecursoHumanoLandingPage />);
  expect(await screen.findByText('Seguimiento a reportes')).toBeInTheDocument();
  expect(reporteSalidaService.getSeguimiento).not.toHaveBeenCalled();
  expect(reporteSalidaService.getConfig).not.toHaveBeenCalled();
  expect(screen.queryByText('Tablero profesores abierto')).not.toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', { name: 'Abrir dashboard' })[0]);
  expect(await screen.findByText('Tablero profesores abierto')).toBeInTheDocument();
});

test('conserva oculta la tarjeta si el backend deniega el acceso', async () => {
  reporteSalidaService.getSeguimientoBadge.mockResolvedValue({ data: { access: { canView: false } } });
  render(<RecursoHumanoLandingPage />);
  expect(await screen.findByText('Profesores')).toBeInTheDocument();
  expect(screen.queryByText('Seguimiento a reportes')).not.toBeInTheDocument();
});
