import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import EstadisticasFormatosHub from './EstadisticasFormatosHub';
import ReporteSalidaEstadisticas from '../reporteSalida/ReporteSalidaEstadisticas';
import reporteSalidaService from '../../services/reporteSalidaService';
import meetingMinuteService from '../../services/meetingMinuteService';

const mockEnqueueSnackbar = jest.fn();

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      email: 'sgc@unicesmag.edu.co',
      role: 'administrador'
    }
  })
}));

jest.mock('notistack', () => ({
  useSnackbar: () => ({
    enqueueSnackbar: mockEnqueueSnackbar
  })
}));

jest.mock('../../services/meetingMinuteService', () => ({
  getStatistics: jest.fn(),
  downloadArchivedPdf: jest.fn(),
  resendArchivedPendingInvitations: jest.fn(),
  deleteArchivedMinutePermanently: jest.fn()
}));

jest.mock('../../services/reporteSalidaService', () => ({
  getEstadisticasFormatos: jest.fn()
}));

jest.mock('recharts', () => {
  const MockBox = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: MockBox,
    PieChart: MockBox,
    Pie: MockBox,
    Sector: MockBox,
    Cell: MockBox,
    BarChart: MockBox,
    Bar: MockBox,
    AreaChart: MockBox,
    Area: MockBox,
    LabelList: () => null,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null
  };
});

const sampleSolicitudes = [
  {
    id: 101,
    estado: 'pendiente_aprobacion_jefe',
    created_at: '2026-03-10T14:00:00.000Z',
    tiempo_solicitado_minutos: 120,
    reposicion_aplica: false,
    reposicion_minutos: 0,
    reposicion_minutos_pagados: 0,
    reposicion_estado: 'no_aplica',
    datos_formulario: {
      salida: {
        categoria: 'salud',
        tipo: 'cita_eps',
        fecha: '2026-03-11'
      }
    }
  },
  {
    id: 102,
    estado: 'finalizada',
    created_at: '2026-03-11T15:00:00.000Z',
    tiempo_solicitado_minutos: 180,
    reposicion_aplica: true,
    reposicion_minutos: 180,
    reposicion_minutos_pagados: 60,
    reposicion_estado: 'pendiente',
    datos_formulario: {
      salida: {
        categoria: 'personales',
        tipo: 'diligencia_personal',
        fecha: '2026-03-12'
      }
    }
  },
  {
    id: 103,
    estado: 'finalizada',
    created_at: '2026-03-12T16:00:00.000Z',
    tiempo_solicitado_minutos: 240,
    reposicion_aplica: true,
    reposicion_minutos: 240,
    reposicion_minutos_pagados: 240,
    reposicion_estado: 'cumplida',
    datos_formulario: {
      salida: {
        categoria: 'personales',
        tipo: 'diligencia_personal',
        fecha: '2026-03-13'
      }
    }
  },
  {
    id: 104,
    estado: 'finalizada',
    created_at: '2026-03-13T16:00:00.000Z',
    tiempo_solicitado_minutos: 60,
    reposicion_aplica: false,
    reposicion_minutos: 0,
    reposicion_minutos_pagados: 0,
    reposicion_estado: 'no_aplica',
    datos_formulario: {
      salida: {
        categoria: 'propias_cargo',
        tipo: 'reunion_institucional',
        fecha: '2026-03-14'
      }
    }
  }
];

beforeEach(() => {
  meetingMinuteService.getStatistics.mockResolvedValue({
    data: {
      retention_days: 30,
      available_years: [2026],
      selected_year: null,
      summary: { total: 0, active: 0, archived: 0, deleted: 0, participants: 0, signed_participants: 0, pending_participants: 0, signature_progress: 0 },
      by_status: [],
      trend: [],
      archive: [],
      recent: []
    }
  });

  reporteSalidaService.getEstadisticasFormatos.mockImplementation(async (year = '') => ({
    success: true,
    data: {
      format_code: 'THM-DP-FR-002',
      read_only: true,
      allow_export: false,
      available_years: [2026, 2025],
      selected_year: year ? Number(year) : null,
      solicitudes: year === '2025' ? [sampleSolicitudes[0]] : sampleSolicitudes
    }
  }));
});

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

test('muestra los dos formatos habilitados en Estadisticas de formatos', () => {
  render(<EstadisticasFormatosHub />);

  expect(screen.getByText('Estadísticas de formatos')).toBeInTheDocument();
  expect(screen.getByText('2 formatos habilitados')).toBeInTheDocument();
  expect(screen.getByText('COM-ID-FR-002 · ACTAS')).toBeInTheDocument();
  expect(screen.getByText('Registro de Asistencia y Reunión')).toBeInTheDocument();
  expect(screen.getByText('THM-DP-FR-002 · SALIDAS')).toBeInTheDocument();
  expect(screen.getByText('Reportes de Salida')).toBeInTheDocument();
});

test('abre Reportes de Salida mostrando solo tarjetas KPI y grafico de picos sin tablas inferiores ni exportacion', async () => {
  render(<EstadisticasFormatosHub />);

  fireEvent.click(screen.getByRole('button', { name: /Ver estadísticas de Reportes de Salida/i }));

  await waitFor(() => {
    expect(reporteSalidaService.getEstadisticasFormatos).toHaveBeenCalledWith('');
    expect(screen.getByText('Flujo Diario de Ausentismo')).toBeInTheDocument();
  });

  const solicitudesCard = screen.getByRole('button', { name: /Solicitudes/i });
  const pendientesCard = screen.getByRole('button', { name: /Pendientes/i });
  const conReposicionCard = screen.getByRole('button', { name: /Con Reposición/i });
  const validadasCard = screen.getByRole('button', { name: /Rep\. Validadas/i });

  expect(within(solicitudesCard).getByText('4')).toBeInTheDocument();
  expect(within(solicitudesCard).getByText('3 aprobadas · 0 rechazadas')).toBeInTheDocument();
  expect(within(pendientesCard).getByText('1')).toBeInTheDocument();
  expect(within(pendientesCard).getByText('25% en trámite de aprobación')).toBeInTheDocument();
  expect(within(conReposicionCard).getByText('1')).toBeInTheDocument();
  expect(within(conReposicionCard).getByText('Pendientes por reponer tiempo')).toBeInTheDocument();
  expect(within(validadasCard).getByText('1')).toBeInTheDocument();
  expect(within(validadasCard).getByText('50% de cumplimiento en reposiciones')).toBeInTheDocument();

  expect(screen.getByText(/Pico máximo:/i)).toBeInTheDocument();
  expect(screen.getByText(/Promedio diario:/i)).toBeInTheDocument();

  expect(screen.queryByText(/Tiempo Total Fuera/i)).toBeNull();
  expect(screen.queryByText(/Total de Permisos Solicitados/i)).toBeNull();
  expect(screen.queryByText(/Ausentismo por/i)).toBeNull();
  expect(screen.queryByText(/Detalle de Solicitudes/i)).toBeNull();
  expect(screen.queryByText(/Exportar/i)).toBeNull();
  expect(screen.queryByTestId('DownloadIcon')).toBeNull();
});

test('filtra por tarjetas KPI, consulta por ano y regresa a tarjetas de formatos', async () => {
  render(<EstadisticasFormatosHub />);

  fireEvent.click(screen.getByRole('button', { name: /Ver estadísticas de Reportes de Salida/i }));

  await waitFor(() => {
    expect(screen.getByText(/Mostrando indicadores del histórico completo: 4 solicitudes\./i)).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole('button', { name: /Pendientes/i }));
  expect(screen.getByText(/Mostrando indicadores del histórico completo: 1 solicitud\./i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /Con Reposición/i }));
  expect(screen.getByText(/Mostrando indicadores del histórico completo: 1 solicitud\./i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /Rep\. Validadas/i }));
  expect(screen.getByText(/Mostrando indicadores del histórico completo: 1 solicitud\./i)).toBeInTheDocument();

  const yearSelect = screen.getByRole('combobox', { name: /Año/i });
  fireEvent.mouseDown(yearSelect);
  fireEvent.click(screen.getByRole('option', { name: '2025' }));

  await waitFor(() => {
    expect(reporteSalidaService.getEstadisticasFormatos).toHaveBeenCalledWith('2025');
  });

  fireEvent.click(screen.getByRole('button', { name: /Volver a formatos/i }));
  expect(screen.getByText('2 formatos habilitados')).toBeInTheDocument();
});

test('ReporteSalidaEstadisticas mantiene tablas detalladas y exportacion habilitada por defecto para Talento Humano', () => {
  render(
    <ReporteSalidaEstadisticas
      rows={sampleSolicitudes.map((row, index) => ({
        ...row,
        consecutivo: `THM-2026-000${index + 1}`,
        solicitante: { userId: index + 1, nombre: `Colaborador ${index + 1}` }
      }))}
    />
  );

  expect(screen.getByText('Total de Permisos Solicitados (Cantidad)')).toBeInTheDocument();
  const downloadIcons = screen.getAllByTestId('DownloadIcon');
  expect(downloadIcons.length).toBeGreaterThan(0);
});
