import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReporteSalidaFormDialog from './ReporteSalidaFormDialog';
import cronogramaMovilidadService from '../../services/cronogramaMovilidadService';
import reporteSalidaService from '../../services/reporteSalidaService';

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: null })
}));

jest.mock('../../services/reporteSalidaService', () => ({
  __esModule: true,
  default: {
    getConfig: jest.fn(() => Promise.resolve({ data: {} })),
    getCatalogoLaboral: jest.fn(() => Promise.resolve({ data: {} })),
    searchEstudiantesMatriculados: jest.fn(),
    uploadAdjunto: jest.fn(),
    radicarSolicitud: jest.fn()
  }
}));

jest.mock('../../services/desplazamientoViaticosService', () => ({
  __esModule: true,
  default: {
    uploadAdjunto: jest.fn(),
    radicarSolicitud: jest.fn()
  }
}));

jest.mock('../../services/cronogramaMovilidadService', () => ({
  __esModule: true,
  default: {
    misActividadesAsignadas: jest.fn(() => Promise.resolve({ actividades: [] }))
  }
}));

jest.mock('../cronogramaMovilidad/CronogramaMovilidadModule', () => () => null);

describe('adjunto del formulario de reporte de salida', () => {
  const documento = { id: 2, codigo: 'THM-DP-FR-002', titulo: 'REPORTE DE SALIDA' };
  const user = {
    id: 42,
    username: '1085000000',
    nombre: 'PERSONA PRUEBA',
    email: 'persona@unicesmag.edu.co',
    role: 'administrador'
  };

  beforeEach(() => {
    reporteSalidaService.getConfig.mockResolvedValue({ data: { consentimientoSalud: {
      version: 'v1', hash: 'hash-prueba', paragraphs: ['Texto de autorización.'], declaration: 'AUTORIZO el tratamiento de mis datos personales y sensibles.'
    } } });
    cronogramaMovilidadService.misActividadesAsignadas.mockResolvedValue({ actividades: [] });
    reporteSalidaService.getCatalogoLaboral.mockResolvedValue({ data: {} });
  });

  const selectUrgencias = () => {
    const select = screen.getByLabelText('Opción / Motivo de la salida *');
    fireEvent.change(select.parentElement.querySelector('input'), { target: { value: 'urgencia_medica' } });
  };

  const completeDates = () => {
    fireEvent.change(screen.getByLabelText(/Fecha de salida a urgencias/), { target: { value: '2099-11-05' } });
    const time = screen.getByRole('combobox', { name: /Hora de salida a urgencias/ });
    fireEvent.change(time, { target: { value: '08:00' } });
    fireEvent.blur(time);
    fireEvent.change(screen.getByLabelText(/Fecha regreso/), { target: { value: '2099-11-05' } });
  };

  test('el Rector radica sin jefe inmediato y sin transmitir el jefe antiguo del perfil', async () => {
    const rector = { ...user, role: 'consulta', cargo: 'RECTOR', dependencia: 'RECTORIA', vicerrectoria: 'RECTORIA', jefe_inmediato: 'Jefa antigua' };
    reporteSalidaService.radicarSolicitud.mockResolvedValue({ success: true, data: { consecutivo: 'RS-RECTOR-TEST' } });
    render(<ReporteSalidaFormDialog open documento={documento} user={rector} onClose={jest.fn()} />);
    expect(screen.queryByLabelText('Jefe inmediato')).not.toBeInTheDocument();
    expect(screen.getByText(/El Rector no requiere jefe inmediato/)).toBeVisible();
    selectUrgencias();
    completeDates();
    fireEvent.click(screen.getByRole('radio', { name: 'No cuento con archivos adjuntos en este momento' }));
    const checkbox = await screen.findByRole('checkbox', { name: /Autorizo.*y acepto la declaración/ });
    await waitFor(() => expect(checkbox).toBeEnabled());
    fireEvent.click(checkbox);
    fireEvent.change(screen.getByLabelText(/Motivo \/ observación/), { target: { value: 'Atención médica' } });
    const submit = screen.getByRole('button', { name: 'Registrar solicitud' });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    await waitFor(() => expect(reporteSalidaService.radicarSolicitud).toHaveBeenCalledWith(expect.objectContaining({ jefeInmediatoUserId: null, jefeInmediato: null })));
    expect(await screen.findByText(/se enviará directamente a Gestión del Talento Humano para su revisión/)).toBeVisible();
  });

  test('la excepción no se extiende a los demás cargos adscritos a Rectoría', () => {
    render(<ReporteSalidaFormDialog open documento={documento} user={{ ...user, cargo: 'Secretaria', dependencia: 'RECTORIA', vicerrectoria: 'RECTORIA' }} onClose={jest.fn()} />);
    expect(screen.getByLabelText('Jefe inmediato')).toBeVisible();
    expect(screen.queryByText(/El Rector no requiere jefe inmediato/)).not.toBeInTheDocument();
  });

  test('conserva el archivo seleccionado cuando se actualizan las propiedades externas', async () => {
    const props = {
      open: true,
      documento,
      user,
      onClose: jest.fn(),
      onSubmitted: jest.fn()
    };
    const { rerender } = render(<ReporteSalidaFormDialog {...props} />);

    selectUrgencias();
    completeDates();

    const fileInput = await waitFor(() => {
      const input = document.querySelector('input[type="file"]');
      expect(input).not.toBeNull();
      return input;
    });
    const attachment = new File(['contenido-pdf'], 'soporte-medico.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [attachment] } });

    expect(await screen.findByText('soporte-medico.pdf')).toBeInTheDocument();

    rerender(<ReporteSalidaFormDialog {...props} user={{ ...user, dependencia: 'DEPENDENCIA ACTUALIZADA' }} />);

    expect(screen.getByText('soporte-medico.pdf')).toBeInTheDocument();
    expect(screen.getByText('Archivo adjuntado correctamente')).toBeInTheDocument();
  });

  test('muestra siempre la autorización en el paso de soportes y deja la observación para el final', async () => {
    render(<ReporteSalidaFormDialog open documento={documento} user={user} onClose={jest.fn()} />);
    expect(screen.queryByText(/Autorizo la verificación de soportes/)).not.toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();
    selectUrgencias();
    expect(document.querySelector('input[type="file"]')).toBeNull();
    completeDates();
    const checkbox = await screen.findByRole('checkbox', { name: /Autorizo la verificación de soportes/ });
    await waitFor(() => expect(checkbox).toBeEnabled());
    expect(checkbox).not.toBeChecked();
    expect(screen.queryByLabelText(/Motivo \/ observación/)).not.toBeInTheDocument();
    fireEvent.click(checkbox);
    expect(screen.getByLabelText(/Motivo \/ observación/)).toBeVisible();
    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [new File(['pdf'], 'soporte.pdf', { type: 'application/pdf' })] } });
    expect(checkbox).not.toBeChecked();
    expect(screen.queryByLabelText(/Motivo \/ observación/)).not.toBeInTheDocument();
    fireEvent.click(checkbox);
    const observation = screen.getByLabelText(/Motivo \/ observación/);
    expect(observation).toBeVisible();
    expect(checkbox.compareDocumentPosition(observation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Registrar solicitud' })).toBeDisabled();
  });

  test('sin adjuntos presenta una sola aceptación conjunta y la renueva al cambiar de opción', async () => {
    render(<ReporteSalidaFormDialog open documento={documento} user={user} onClose={jest.fn()} />);
    selectUrgencias();
    completeDates();
    fireEvent.click(screen.getByRole('radio', { name: 'No cuento con archivos adjuntos en este momento' }));
    expect(document.querySelector('input[type="file"]')).toBeNull();
    const checkbox = await screen.findByRole('checkbox', { name: /Autorizo.*y acepto la declaración/ });
    await waitFor(() => expect(checkbox).toBeEnabled());
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    expect(screen.queryByLabelText(/Motivo \/ observación/)).not.toBeInTheDocument();
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(screen.getByLabelText(/Motivo \/ observación/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Leer autorización' }));
    expect(screen.getAllByText(/Declaro que al momento de radicar esta solicitud/)).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Autorización de Salud y Bienestar' })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('radio', { name: 'Adjuntar soporte' }));
    expect(screen.queryByRole('checkbox', { name: /y acepto la declaración/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Motivo \/ observación/)).not.toBeInTheDocument();
    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [new File(['pdf'], 'soporte.pdf', { type: 'application/pdf' })] } });
    const newCheckbox = await screen.findByRole('checkbox', { name: /Autorizo la verificación de soportes/ });
    await waitFor(() => expect(newCheckbox).toBeEnabled());
    expect(newCheckbox).not.toBeChecked();
  });
});
