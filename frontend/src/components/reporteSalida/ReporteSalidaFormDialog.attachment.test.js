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

  test('presenta la aceptación después de completar las fechas y adjuntar el soporte', async () => {
    render(<ReporteSalidaFormDialog open documento={documento} user={user} onClose={jest.fn()} />);
    expect(screen.queryByText(/Autorizo la verificación de soportes/)).not.toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();
    selectUrgencias();
    expect(document.querySelector('input[type="file"]')).toBeNull();
    completeDates();
    expect(screen.queryByText(/Autorizo la verificación de soportes/)).not.toBeInTheDocument();
    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [new File(['pdf'], 'soporte.pdf', { type: 'application/pdf' })] } });
    const checkbox = await screen.findByRole('checkbox', { name: /Autorizo la verificación de soportes/ });
    await waitFor(() => expect(checkbox).toBeEnabled());
    expect(checkbox).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Registrar solicitud' })).toBeDisabled();
  });

  test('sin adjuntos presenta una sola aceptación conjunta y la renueva al cambiar de opción', async () => {
    render(<ReporteSalidaFormDialog open documento={documento} user={user} onClose={jest.fn()} />);
    selectUrgencias();
    completeDates();
    fireEvent.click(screen.getByRole('radio', { name: 'No cuento con archivos adjuntos en este momento' }));
    expect(document.querySelector('input[type="file"]')).toBeNull();
    const checkbox = await screen.findByRole('checkbox', { name: /Declaro que no cuento con soportes/ });
    await waitFor(() => expect(checkbox).toBeEnabled());
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Leer autorización' }));
    expect(screen.getAllByText(/Declaro que al momento de radicar esta solicitud/)).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Autorización de Salud y Bienestar' })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('radio', { name: 'Adjuntar soporte' }));
    expect(screen.queryByRole('checkbox', { name: /Declaro que no cuento con soportes/ })).not.toBeInTheDocument();
    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [new File(['pdf'], 'soporte.pdf', { type: 'application/pdf' })] } });
    const newCheckbox = await screen.findByRole('checkbox', { name: /Autorizo la verificación de soportes/ });
    await waitFor(() => expect(newCheckbox).toBeEnabled());
    expect(newCheckbox).not.toBeChecked();
  });
});
