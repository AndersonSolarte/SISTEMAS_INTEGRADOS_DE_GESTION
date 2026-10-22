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
    cronogramaMovilidadService.misActividadesAsignadas.mockResolvedValue({ actividades: [] });
    reporteSalidaService.getCatalogoLaboral.mockResolvedValue({ data: {} });
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

    const motiveSelect = screen.getByLabelText('Opción / Motivo de la salida *');
    const nativeSelectInput = motiveSelect.parentElement.querySelector('input');
    fireEvent.change(nativeSelectInput, { target: { value: 'cita_particular' } });

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
});
