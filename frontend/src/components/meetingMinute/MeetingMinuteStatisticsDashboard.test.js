import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import MeetingMinuteStatisticsDashboard, {
  matchesExactResponsible
} from './MeetingMinuteStatisticsDashboard';
import meetingMinuteService from '../../services/meetingMinuteService';

const mockEnqueueSnackbar = jest.fn();

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
    LabelList: () => null,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null
  };
});

const mockStatsPayload = {
  data: {
    retention_days: 30,
    available_years: [2026],
    selected_year: null,
    summary: {
      total: 3,
      active: 2,
      archived: 1,
      deleted: 0,
      draft: 1,
      signing: 1,
      signed: 1,
      distributed: 0,
      completed: 1,
      participants: 10,
      signed_participants: 8,
      pending_participants: 2,
      signature_progress: 80
    },
    by_status: [
      { status: 'draft', label: 'Borrador', total: 1 },
      { status: 'signing', label: 'En firmas', total: 1 },
      { status: 'signed', label: 'Firmadas', total: 1 }
    ],
    trend: [{ key: '2026', label: '2026', total: 3 }],
    archive: [
      {
        id: 'm-1',
        code: 'ACTA-2026-007520334',
        title: 'Revisión de caso estudiante Laura Sofia Gonzalez',
        meeting_date: '2026-11-18',
        created_at: '2026-11-18T10:00:00Z',
        status: 'signed',
        lifecycle: 'operational',
        creator: 'Sofia Valeria Martinez Salas',
        creator_name: 'Sofia Valeria Martinez Salas',
        creator_document: '1004555666',
        responsible_name: 'Sofia Valeria Martinez Salas',
        responsible_document: '1004555666',
        responsables: [
          { name: 'Sofia Valeria Martinez Salas', document: '1004555666', is_primary: true }
        ],
        dependency: 'Area de Acompañamiento Integral',
        participants: 6,
        signed_participants: 6,
        pending_participants: 0,
        archive_location: 'Base de datos SIAC · Plantilla COM-IF-FR-002'
      },
      {
        id: 'm-2',
        code: 'ACTA-2026-238767361',
        title: 'Comité de Calidad Institucional',
        meeting_date: '2026-11-10',
        created_at: '2026-11-10T10:00:00Z',
        status: 'signing',
        lifecycle: 'operational',
        creator: 'Anderson David Solarte Caicedo',
        creator_name: 'Administrador del Sistema - Siac',
        creator_document: '789545',
        responsible_name: 'Anderson David Solarte Caicedo',
        responsible_document: '1085327166',
        responsables: [
          { name: 'Anderson David Solarte Caicedo', document: '1085327166', is_primary: true }
        ],
        dependency: 'Direccion de Planeacion y Aseguramiento de la Calidad',
        participants: 4,
        signed_participants: 2,
        pending_participants: 2,
        archive_location: 'Base de datos SIAC · Plantilla COM-IF-FR-002'
      },
      {
        id: 'm-3',
        code: 'ACTA-2026-005726379',
        title: 'Seguimiento Plan de Mejoramiento',
        meeting_date: '2026-10-01',
        created_at: '2026-10-01T10:00:00Z',
        status: 'draft',
        lifecycle: 'archived',
        creator: 'Anderson David Solarte Caicedo',
        creator_name: 'Anderson David Solarte Caicedo',
        creator_document: '1085327166',
        responsible_name: 'Anderson David Solarte Caicedo',
        responsible_document: '1085327166',
        responsables: [
          { name: 'Anderson David Solarte Caicedo', document: '1085327166', is_primary: true },
          { name: 'Adriana Carolina Valdes Chicunque', document: '1087648128', is_primary: false }
        ],
        dependency: 'Vicerrectoria Academica',
        participants: 0,
        signed_participants: 0,
        pending_participants: 0,
        archive_location: 'Base de datos SIAC · Plantilla COM-IF-FR-002'
      }
    ]
  }
};

beforeEach(() => {
  meetingMinuteService.getStatistics.mockResolvedValue(mockStatsPayload);
  meetingMinuteService.downloadArchivedPdf.mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));
  meetingMinuteService.resendArchivedPendingInvitations.mockResolvedValue({ success: true, message: 'Enviado a pendientes' });
  meetingMinuteService.deleteArchivedMinutePermanently.mockResolvedValue({ success: true, message: 'Eliminado definitivamente' });
});

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

test('coincidencia exacta rechaza subcadenas parciales y acepta nombre completo o cédula exacta', () => {
  const row = mockStatsPayload.data.archive[0];
  expect(matchesExactResponsible(row, '')).toBe(true);
  expect(matchesExactResponsible(row, '1004')).toBe(false);
  expect(matchesExactResponsible(row, 'Sofia')).toBe(false);
  expect(matchesExactResponsible(row, 'Sofia Valeria')).toBe(false);
  expect(matchesExactResponsible(row, '1004555666')).toBe(true);
  expect(matchesExactResponsible(row, 'CC 1004555666')).toBe(true);
  expect(matchesExactResponsible(row, 'Sofía Valeria Martínez Salas')).toBe(true);
  expect(matchesExactResponsible(row, '  sofia   valeria martinez salas ')).toBe(true);
});

test('navega desde la tarjeta de formato y filtra la tabla únicamente por coincidencias exactas', async () => {
  render(<MeetingMinuteStatisticsDashboard />);

  const openButton = screen.getByRole('button', { name: /Ver estadísticas/i });
  fireEvent.click(openButton);

  await waitFor(() => {
    expect(screen.getByText('Control de archivo de actas')).toBeInTheDocument();
  });

  expect(screen.getByText('ACTA-2026-007520334')).toBeInTheDocument();
  expect(screen.getByText('ACTA-2026-238767361')).toBeInTheDocument();
  expect(screen.getByText('ACTA-2026-005726379')).toBeInTheDocument();

  const filterInput = screen.getByLabelText(/Filtrar responsable por cédula o nombre exacto/i);

  // Búsqueda parcial por cédula NO debe mostrar coincidencias
  fireEvent.change(filterInput, { target: { value: '1085' } });
  expect(screen.queryByText('ACTA-2026-238767361')).toBeNull();
  expect(screen.queryByText('ACTA-2026-005726379')).toBeNull();
  expect(screen.getByText(/0 de 3 documento\(s\)/i)).toBeInTheDocument();

  // Búsqueda exacta por cédula SÍ muestra únicamente sus actas
  fireEvent.change(filterInput, { target: { value: '1085327166' } });
  expect(screen.queryByText('ACTA-2026-007520334')).toBeNull();
  expect(screen.getByText('ACTA-2026-238767361')).toBeInTheDocument();
  expect(screen.getByText('ACTA-2026-005726379')).toBeInTheDocument();
  expect(screen.getByText(/2 de 3 documento\(s\)/i)).toBeInTheDocument();

  // Búsqueda parcial por nombre NO debe mostrar coincidencias
  fireEvent.change(filterInput, { target: { value: 'Sofia' } });
  expect(screen.queryByText('ACTA-2026-007520334')).toBeNull();
  expect(screen.getByText(/0 de 3 documento\(s\)/i)).toBeInTheDocument();

  // Búsqueda exacta por nombre completo (con acentos/mayúsculas distintos) SÍ muestra coincidencia
  fireEvent.change(filterInput, { target: { value: 'Sofía Valeria Martínez Salas' } });
  expect(screen.getByText('ACTA-2026-007520334')).toBeInTheDocument();
  expect(screen.queryByText('ACTA-2026-238767361')).toBeNull();
  expect(screen.queryByText('ACTA-2026-005726379')).toBeNull();
  expect(screen.getByText(/1 de 3 documento\(s\)/i)).toBeInTheDocument();

  // Limpiar filtro restaura todas las filas
  const clearButtons = screen.getAllByRole('button', { name: /Limpiar filtro/i });
  fireEvent.click(clearButtons[0]);
  expect(screen.getByText('ACTA-2026-007520334')).toBeInTheDocument();
  expect(screen.getByText('ACTA-2026-238767361')).toBeInTheDocument();
  expect(screen.getByText('ACTA-2026-005726379')).toBeInTheDocument();
  expect(screen.getByText('3 documento(s)')).toBeInTheDocument();
});

test('resalta bidireccionalmente el estado seleccionado y actualiza el indicador central del anillo', async () => {
  render(<MeetingMinuteStatisticsDashboard />);
  fireEvent.click(screen.getByRole('button', { name: /Ver estadísticas/i }));

  await waitFor(() => {
    expect(screen.getByText('Total actas')).toBeInTheDocument();
  });

  const firmadasSegment = screen.getByRole('button', { name: /Firmadas/i });
  fireEvent.mouseEnter(firmadasSegment);
  expect(screen.queryByText('Total actas')).toBeNull();
  expect(screen.getByText('33%')).toBeInTheDocument();

  fireEvent.mouseLeave(firmadasSegment);
  expect(screen.getByText('Total actas')).toBeInTheDocument();

  fireEvent.click(firmadasSegment);
  expect(screen.queryByText('Total actas')).toBeNull();
  expect(screen.getByText('33%')).toBeInTheDocument();

  fireEvent.click(firmadasSegment);
  expect(screen.getByText('Total actas')).toBeInTheDocument();
});

test('pagina de 25 registros y encuentra coincidencias exactas de cualquier página', async () => {
  const manyRows = Array.from({ length: 28 }, (_, index) => ({
    id: `many-${index + 1}`,
    code: `ACTA-2026-${String(index + 1).padStart(4, '0')}`,
    title: `Acta ${index + 1}`,
    meeting_date: '2026-11-18',
    created_at: '2026-11-18T10:00:00Z',
    status: 'signed',
    lifecycle: 'operational',
    responsible_name: index === 27 ? 'Carlos Andres Perez' : `Usuario Prueba ${index + 1}`,
    responsible_document: index === 27 ? '99887766' : String(1000000 + index),
    responsables: [
      {
        name: index === 27 ? 'Carlos Andres Perez' : `Usuario Prueba ${index + 1}`,
        document: index === 27 ? '99887766' : String(1000000 + index),
        is_primary: true
      }
    ],
    dependency: 'Calidad',
    participants: 2,
    signed_participants: 2,
    archive_location: 'Base de datos SIAC · Plantilla COM-IF-FR-002'
  }));

  meetingMinuteService.getStatistics.mockResolvedValueOnce({
    data: {
      ...mockStatsPayload.data,
      summary: { ...mockStatsPayload.data.summary, total: 28 },
      archive: manyRows
    }
  });

  render(<MeetingMinuteStatisticsDashboard />);
  fireEvent.click(screen.getByRole('button', { name: /Ver estadísticas/i }));

  await waitFor(() => {
    expect(screen.getByText('ACTA-2026-0001')).toBeInTheDocument();
  });

  expect(screen.queryByText('ACTA-2026-0028')).toBeNull();
  expect(screen.getByText('Página 1 de 2')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
  expect(screen.getByText('ACTA-2026-0028')).toBeInTheDocument();
  expect(screen.getByText('Página 2 de 2')).toBeInTheDocument();

  const filterInput = screen.getByLabelText(/Filtrar responsable por cédula o nombre exacto/i);
  fireEvent.change(filterInput, { target: { value: '99887766' } });
  expect(screen.getByText('ACTA-2026-0028')).toBeInTheDocument();
  expect(screen.getByText(/1 de 28 documento\(s\)/i)).toBeInTheDocument();
});

test('menú de 3 puntos ofrece visualizar, descargar, enviar firmas solo si hay pendientes y eliminar definitivamente', async () => {
  const originalCreateObjectURL = window.URL.createObjectURL;
  const originalRevokeObjectURL = window.URL.revokeObjectURL;
  window.URL.createObjectURL = jest.fn(() => 'blob:mock-pdf');
  window.URL.revokeObjectURL = jest.fn();
  const anchorClickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  try {
    render(<MeetingMinuteStatisticsDashboard />);
    fireEvent.click(screen.getByRole('button', { name: /Ver estadísticas/i }));

    await waitFor(() => {
      expect(screen.getByText('ACTA-2026-007520334')).toBeInTheDocument();
    });

    const actionButtons = screen.getAllByRole('button', { name: /Acciones del acta/i });
    expect(actionButtons).toHaveLength(3);

    // m-1 está firmada (0 pendientes): no muestra "Enviar firmas a pendientes"
    fireEvent.click(actionButtons[0]);
    expect(screen.getByText('Visualizar')).toBeInTheDocument();
    expect(screen.getByText('Descargar acta')).toBeInTheDocument();
    expect(screen.getByText('Eliminar registro')).toBeInTheDocument();
    expect(screen.queryByText('Enviar firmas a pendientes')).toBeNull();

    fireEvent.click(screen.getByText('Visualizar'));
    await waitFor(() => {
      expect(meetingMinuteService.downloadArchivedPdf).toHaveBeenCalledWith('m-1');
    });
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Acciones del acta/i })[0]).toBeEnabled();
    });

    // La fila m-1 permanece seleccionada después de cerrar el menú y ejecutar Visualizar
    const rowsAfterView = screen.getAllByRole('row');
    expect(rowsAfterView[1]).toHaveAttribute('data-selected', 'true');
    expect(rowsAfterView[2]).toHaveAttribute('data-selected', 'false');

    // Descargar acta en m-1
    fireEvent.click(screen.getAllByRole('button', { name: /Acciones del acta/i })[0]);
    fireEvent.click(screen.getByText('Descargar acta'));
    await waitFor(() => {
      expect(meetingMinuteService.downloadArchivedPdf).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Acciones del acta/i })[1]).toBeEnabled();
    });

    // m-2 tiene 2 pendientes: sí muestra "Enviar firmas a pendientes" y pasa la selección a m-2
    fireEvent.click(screen.getAllByRole('button', { name: /Acciones del acta/i })[1]);
    expect(screen.getByText('Enviar firmas a pendientes')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Enviar firmas a pendientes'));
    await waitFor(() => {
      expect(meetingMinuteService.resendArchivedPendingInvitations).toHaveBeenCalledWith('m-2', {
        public_base_url: window.location.origin
      });
    });
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Acciones del acta/i })[2]).toBeEnabled();
    });
    const rowsAfterSelectSecond = screen.getAllByRole('row');
    expect(rowsAfterSelectSecond[1]).toHaveAttribute('data-selected', 'false');
    expect(rowsAfterSelectSecond[2]).toHaveAttribute('data-selected', 'true');

    // Eliminar registro en m-3 abre confirmación y elimina definitivamente
    fireEvent.click(screen.getAllByRole('button', { name: /Acciones del acta/i })[2]);
    fireEvent.click(screen.getByText('Eliminar registro'));
    expect(screen.getByText('¿Eliminar registro definitivamente?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Eliminar definitivamente/i }));
    await waitFor(() => {
      expect(meetingMinuteService.deleteArchivedMinutePermanently).toHaveBeenCalledWith('m-3');
    });
    await waitFor(() => {
      expect(screen.queryByText('¿Eliminar registro definitivamente?')).toBeNull();
    });
  } finally {
    anchorClickSpy.mockRestore();
    window.URL.createObjectURL = originalCreateObjectURL;
    window.URL.revokeObjectURL = originalRevokeObjectURL;
  }
}, 15000);
