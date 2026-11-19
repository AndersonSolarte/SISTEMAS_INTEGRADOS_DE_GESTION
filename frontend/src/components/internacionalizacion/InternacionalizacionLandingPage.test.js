import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import InternacionalizacionLandingPage from './InternacionalizacionLandingPage';
import InternacionalizacionMovilidadDashboard from './InternacionalizacionMovilidadDashboard';
import gestionInformacionService from '../../services/gestionInformacionService';
import { ROLES } from '../../constants/roles';

const mockEnqueueSnackbar = jest.fn();

jest.mock('notistack', () => ({
  useSnackbar: () => ({
    enqueueSnackbar: mockEnqueueSnackbar
  })
}));

jest.mock('../../services/gestionInformacionService', () => ({
  getMovilidadDashboard: jest.fn(),
  getConveniosDashboard: jest.fn()
}));

jest.mock('recharts', () => {
  const MockBox = ({ children }) => <div>{children}</div>;
  const MockChart = () => <div />;
  const MockPieChart = ({ children, onMouseLeave }) => (
    <div onMouseLeave={onMouseLeave}>{children}</div>
  );
  const MockPie = ({ data = [], onMouseEnter, onMouseLeave }) => (
    <div>
      {data.map((item) => (
        <div
          key={item.name}
          data-testid={`mock-pie-slice-${item.name}`}
          onMouseEnter={() => onMouseEnter?.(item)}
          onMouseLeave={() => onMouseLeave?.()}
        />
      ))}
    </div>
  );
  return {
    ResponsiveContainer: MockBox,
    BarChart: MockChart,
    Bar: MockChart,
    PieChart: MockPieChart,
    Pie: MockPie,
    Cell: () => null,
    Sector: () => null,
    LabelList: () => null,
    AreaChart: MockChart,
    Area: MockChart,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null
  };
});

const mockMovilidadResponse = {
  data: {
    total: 10,
    byPeriodo: [
      { name: '2025-1', value: 4 },
      { name: '2025-2', value: 6 }
    ],
    byAlcance: [
      { name: 'Internacional', value: 7 },
      { name: 'Nacional', value: 3 }
    ],
    byDireccion: [
      { name: 'Saliente', value: 6 },
      { name: 'Entrante', value: 4 }
    ],
    byTipoPersona: [
      { name: 'Estudiante', value: 8 },
      { name: 'Docente', value: 2 }
    ],
    byPais: [
      { name: 'México', value: 7 },
      { name: 'Colombia', value: 3 }
    ],
    byActividad: [{ name: 'Intercambio', value: 10 }],
    byTipoMovilidad: [{ name: 'Semestre académico de intercambio', value: 10 }],
    byPrograma: [{ name: 'Ingeniería de Sistemas', value: 10 }],
    byModalidad: [{ name: 'Presencial', value: 10 }],
    heatmapPeriodoDireccion: {
      Saliente: { '2025-1': 2, '2025-2': 4 },
      Entrante: { '2025-1': 2, '2025-2': 2 }
    },
    catalogos: {
      periodos: ['2025-1', '2025-2'],
      alcances: ['Internacional', 'Nacional'],
      direcciones: ['Entrante', 'Saliente'],
      tiposPersona: ['Docente', 'Estudiante'],
      paises: ['Colombia', 'México'],
      programas: ['Derecho', 'Ingeniería de Sistemas']
    }
  }
};

describe('InternacionalizacionLandingPage y Estadística de Movilidad', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    gestionInformacionService.getMovilidadDashboard.mockResolvedValue(mockMovilidadResponse);
  });

  afterEach(() => {
    cleanup();
  });

  test('muestra solo las 3 tarjetas de submódulos y no muestra el mapa ni las secciones estadísticas previas en el landing', () => {
    const { container } = render(
      <InternacionalizacionLandingPage
        user={{ role: ROLES.ADMINISTRADOR }}
        onBack={jest.fn()}
      />
    );

    expect(screen.getByText('Gestión Estadística')).toBeInTheDocument();
    expect(screen.getByText('Estadística de Movilidad')).toBeInTheDocument();
    expect(screen.getByText('Convenios')).toBeInTheDocument();

    expect(screen.queryByText('Mapa institucional de internacionalización')).not.toBeInTheDocument();
    expect(screen.queryByText('Esquema estadístico por población')).not.toBeInTheDocument();
    expect(screen.queryByText('Convenios y cooperación interinstitucional')).not.toBeInTheDocument();
    expect(container.querySelector('img[src="/internacionalizacion-mapa.png"]')).toBeNull();
  });

  test('al abrir Estadística de Movilidad muestra el logo ORI como marca de agua de fondo', async () => {
    render(
      <InternacionalizacionLandingPage
        user={{ role: ROLES.ADMINISTRADOR }}
        onBack={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText('Estadística de Movilidad'));

    const backdrop = await screen.findByTestId('movilidad-watermark-backdrop');
    expect(backdrop).toBeInTheDocument();

    const watermarkImg = backdrop.querySelector('img[src="/internacionalizacion-mapa.png"]');
    expect(watermarkImg).not.toBeNull();
    expect(watermarkImg.getAttribute('src')).toBe('/internacionalizacion-mapa.png');

    await waitFor(() => {
      expect(gestionInformacionService.getMovilidadDashboard).toHaveBeenCalled();
    });
  });

  test('ChecklistFilter deselecciona todos en un clic, selecciona una opción puntual y restaura todos', async () => {
    render(
      <InternacionalizacionMovilidadDashboard
        onBack={jest.fn()}
        onNavigateConvenios={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(gestionInformacionService.getMovilidadDashboard).toHaveBeenCalledTimes(1);
    });

    const alcanceTrigger = await screen.findByRole('button', { name: /Filtro Alcance: TODOS/i });
    fireEvent.click(alcanceTrigger);

    const deselectAllBtn = await screen.findByText('DESELECCIONAR TODOS (2)');
    fireEvent.click(deselectAllBtn);

    expect(screen.getByRole('button', { name: /Filtro Alcance: Ninguno/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Hay filtros sin opciones seleccionadas/i)
    ).toBeInTheDocument();
    expect(gestionInformacionService.getMovilidadDashboard).toHaveBeenCalledTimes(1);

    const nacionalOption = screen.getByRole('option', { name: 'Nacional' });
    fireEvent.click(nacionalOption);

    expect(screen.getByRole('button', { name: /Filtro Alcance: Nacional/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(gestionInformacionService.getMovilidadDashboard).toHaveBeenLastCalledWith({
        alcance: ['Nacional']
      });
    });

    const selectAllBtn = screen.getByText('SELECCIONAR TODOS (2)');
    fireEvent.click(selectAllBtn);

    expect(screen.getByRole('button', { name: /Filtro Alcance: TODOS/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(gestionInformacionService.getMovilidadDashboard).toHaveBeenLastCalledWith({});
    });
  });

  test('actualiza el contador KPI a 0 cuando Salientes pasa a 0 tras filtrar por Entrante', async () => {
    gestionInformacionService.getMovilidadDashboard
      .mockResolvedValueOnce(mockMovilidadResponse)
      .mockResolvedValueOnce({
        data: {
          ...mockMovilidadResponse.data,
          total: 4,
          byDireccion: [{ name: 'Entrante', value: 4 }]
        }
      });

    render(
      <InternacionalizacionMovilidadDashboard
        onBack={jest.fn()}
        onNavigateConvenios={jest.fn()}
      />
    );

    const salientesLabel = await screen.findByText('movilidades al exterior');
    const salientesCard = salientesLabel.closest('.MuiPaper-root');

    await waitFor(() => {
      expect(within(salientesCard).getByText('6')).toBeInTheDocument();
    });

    const direccionTrigger = screen.getByRole('button', { name: /Filtro Dirección: TODOS/i });
    fireEvent.click(direccionTrigger);
    fireEvent.click(screen.getByRole('option', { name: 'Saliente' }));

    await waitFor(() => {
      expect(gestionInformacionService.getMovilidadDashboard).toHaveBeenLastCalledWith({
        direccion: ['Entrante']
      });
    });

    await waitFor(() => {
      expect(within(salientesCard).getByText('0')).toBeInTheDocument();
    });
  });

  test('aplica filtrado bidireccional en UI con conteos, indicador reducido, chip activo y restauración', async () => {
    const fullPayload = {
      data: {
        ...mockMovilidadResponse.data,
        catalogos: {
          periodos: ['2025-1', '2025-2'],
          alcances: ['Internacional', 'Nacional'],
          direcciones: ['Entrante', 'Saliente'],
          tiposPersona: ['Docente', 'Estudiante'],
          paises: ['Colombia', 'México']
        },
        catalogosCounts: {
          periodos: { '2025-1': 4, '2025-2': 6 },
          alcances: { Internacional: 7, Nacional: 3 },
          direcciones: { Entrante: 4, Saliente: 6 },
          tiposPersona: { Docente: 2, Estudiante: 8 },
          paises: { Colombia: 3, México: 7 }
        },
        masterCatalogos: {
          periodos: ['2025-1', '2025-2'],
          alcances: ['Internacional', 'Nacional'],
          direcciones: ['Entrante', 'Saliente'],
          tiposPersona: ['Docente', 'Estudiante'],
          paises: ['Colombia', 'México']
        }
      }
    };

    const filteredNacionalPayload = {
      data: {
        ...fullPayload.data,
        total: 3,
        byAlcance: [{ name: 'Nacional', value: 3 }],
        byPais: [{ name: 'Colombia', value: 3 }],
        catalogos: {
          periodos: ['2025-1'],
          alcances: ['Internacional', 'Nacional'],
          direcciones: ['Saliente'],
          tiposPersona: ['Estudiante'],
          paises: ['Colombia']
        },
        catalogosCounts: {
          periodos: { '2025-1': 3 },
          alcances: { Internacional: 7, Nacional: 3 },
          direcciones: { Saliente: 3 },
          tiposPersona: { Estudiante: 3 },
          paises: { Colombia: 3 }
        }
      }
    };

    gestionInformacionService.getMovilidadDashboard
      .mockResolvedValueOnce(fullPayload)
      .mockResolvedValueOnce(filteredNacionalPayload)
      .mockResolvedValueOnce(fullPayload);

    render(
      <InternacionalizacionMovilidadDashboard
        onBack={jest.fn()}
        onNavigateConvenios={jest.fn()}
      />
    );

    const alcanceTrigger = await screen.findByRole('button', { name: /Filtro Alcance: TODOS/i });
    fireEvent.click(alcanceTrigger);
    fireEvent.click(screen.getByText('DESELECCIONAR TODOS (2)'));
    fireEvent.click(screen.getByRole('option', { name: /^Nacional/i }));

    await waitFor(() => {
      expect(gestionInformacionService.getMovilidadDashboard).toHaveBeenLastCalledWith({
        alcance: ['Nacional']
      });
    });

    expect(await screen.findByTestId('filter-ratio-País')).toHaveTextContent('1/2');
    expect(screen.getByText('Alcance: Nacional')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Filtro País: TODOS/i }));
    const paisListbox = await screen.findByRole('listbox', { name: /Opciones de País/i });
    expect(within(paisListbox).getByRole('option', { name: /^Colombia/i })).toBeInTheDocument();
    expect(within(paisListbox).getByText('3')).toBeInTheDocument();
    expect(within(paisListbox).queryByRole('option', { name: /^México/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Limpiar filtros'));

    await waitFor(() => {
      expect(gestionInformacionService.getMovilidadDashboard).toHaveBeenLastCalledWith({});
    });

    await waitFor(() => {
      expect(screen.queryByTestId('filter-ratio-País')).not.toBeInTheDocument();
    });

    const restoredListbox = screen.getByRole('listbox', { name: /Opciones de País/i });
    expect(within(restoredListbox).getByRole('option', { name: /^Colombia/i })).toBeInTheDocument();
    expect(within(restoredListbox).getByRole('option', { name: /^México/i })).toBeInTheDocument();
  });

  test('filtro Programa o dependencia permite buscar sin tildes y filtrar con chip activo', async () => {
    render(
      <InternacionalizacionMovilidadDashboard
        onBack={jest.fn()}
        onNavigateConvenios={jest.fn()}
      />
    );

    const progTrigger = await screen.findByRole('button', { name: /Filtro Programa o dependencia: TODOS/i });
    fireEvent.click(progTrigger);

    const progListbox = await screen.findByRole('listbox', { name: /Opciones de Programa o dependencia/i });
    const searchInput = within(progListbox).getByPlaceholderText(/Buscar programa o dependencia/i);
    fireEvent.change(searchInput, { target: { value: 'ingenieria' } });

    expect(within(progListbox).getByRole('option', { name: /^Ingeniería de Sistemas/i })).toBeInTheDocument();
    expect(within(progListbox).queryByRole('option', { name: /^Derecho/i })).not.toBeInTheDocument();

    fireEvent.click(within(progListbox).getByText('Ninguno'));
    fireEvent.change(searchInput, { target: { value: 'ingenieria' } });
    fireEvent.click(within(progListbox).getByRole('option', { name: /^Ingeniería de Sistemas/i }));

    await waitFor(() => {
      expect(gestionInformacionService.getMovilidadDashboard).toHaveBeenLastCalledWith({
        programa: ['Ingeniería de Sistemas']
      });
    });

    expect(screen.getByText('Programa o dependencia: Ingeniería de Sistemas')).toBeInTheDocument();
  });

  test('sincroniza hover bidireccional entre gráficas donut y filas de datos', async () => {
    render(
      <InternacionalizacionMovilidadDashboard
        onBack={jest.fn()}
        onNavigateConvenios={jest.fn()}
      />
    );

    const alcanceCenter = await screen.findByTestId('alcance-donut-center');
    const silhouettes = screen.getAllByTestId('kpi-silhouette');
    expect(silhouettes).toHaveLength(4);
    expect(silhouettes[0]).toHaveAttribute('data-motion', 'rise');
    expect(silhouettes[1]).toHaveAttribute('data-motion', 'orbit');
    expect(silhouettes[2]).toHaveAttribute('data-motion', 'takeoff');
    expect(silhouettes[3]).toHaveAttribute('data-motion', 'landing');
    const nacionalRow = screen.getByTestId('alcance-row-Nacional');
    const internacionalRow = screen.getByTestId('alcance-row-Internacional');

    expect(within(alcanceCenter).getByText('10')).toBeInTheDocument();
    expect(within(alcanceCenter).getByText('Total')).toBeInTheDocument();
    expect(nacionalRow).toHaveAttribute('data-active', 'false');

    fireEvent.mouseEnter(nacionalRow);
    expect(nacionalRow).toHaveAttribute('data-active', 'true');
    expect(internacionalRow).toHaveAttribute('data-active', 'false');
    expect(within(alcanceCenter).getByText('3')).toBeInTheDocument();
    expect(within(alcanceCenter).getByText('Nacional')).toBeInTheDocument();
    expect(within(alcanceCenter).getByText(/30\.0%/i)).toBeInTheDocument();

    fireEvent.mouseLeave(nacionalRow);
    expect(nacionalRow).toHaveAttribute('data-active', 'false');
    expect(within(alcanceCenter).getByText('10')).toBeInTheDocument();
    expect(within(alcanceCenter).getByText('Total')).toBeInTheDocument();

    const internacionalSlice = screen.getByTestId('mock-pie-slice-Internacional');
    fireEvent.mouseEnter(internacionalSlice);
    expect(internacionalRow).toHaveAttribute('data-active', 'true');
    expect(nacionalRow).toHaveAttribute('data-active', 'false');
    expect(within(alcanceCenter).getByText('7')).toBeInTheDocument();
    expect(within(alcanceCenter).getByText('Internacional')).toBeInTheDocument();
    expect(within(alcanceCenter).getByText(/70\.0%/i)).toBeInTheDocument();

    fireEvent.mouseLeave(internacionalSlice);
    expect(internacionalRow).toHaveAttribute('data-active', 'false');

    const personaCenter = screen.getByTestId('persona-donut-center');
    const docenteRow = screen.getByTestId('persona-row-Docente');
    fireEvent.mouseEnter(docenteRow);
    expect(docenteRow).toHaveAttribute('data-active', 'true');
    expect(within(personaCenter).getByText('2')).toBeInTheDocument();
    expect(within(personaCenter).getByText('Docente')).toBeInTheDocument();
    expect(within(personaCenter).getByText('20.0%')).toBeInTheDocument();
  });
});
