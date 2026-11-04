import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ConsentimientoSalud from './ConsentimientoSalud';
import reporteSalidaService from '../../services/reporteSalidaService';

jest.mock('../../services/reporteSalidaService', () => ({ __esModule: true, default: { getConfig: jest.fn() } }));
const policy = {
  title: 'AUTORIZACIÓN PARA LA VERIFICACIÓN', version: 'v1', hash: 'abc123',
  paragraphs: ['Texto completo del oficio.', 'Esta autorización no comprende el acceso a mi historia clínica.'],
  declarationTitle: 'Manifestación expresa de autorización:',
  declaration: 'AUTORIZO el tratamiento de mis datos personales, incluidos los datos sensibles.',
  fields: ['Nombre: __________________', 'Documento de identidad: __________________', 'Firma: __________________', 'Fecha: __________________']
};

test('muestra el texto completo y exige una selección expresa que se puede retirar', async () => {
  reporteSalidaService.getConfig.mockResolvedValue({ data: { consentimientoSalud: policy } });
  const onChange = jest.fn();
  function Form() {
    const [value, setValue] = useState(null);
    return <ConsentimientoSalud value={value} onChange={(next) => { onChange(next); setValue(next); }} />;
  }
  render(<Form />);
  const checkbox = screen.getByRole('checkbox');
  expect(checkbox).not.toBeChecked();
  expect(screen.getByRole('alert')).toHaveTextContent('Debe aceptar');
  await waitFor(() => expect(checkbox).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Leer autorización' }));
  expect(screen.getByText(policy.paragraphs[0])).toBeVisible();
  expect(screen.getByText(policy.paragraphs[1])).toBeVisible();
  expect(screen.getByText(policy.declaration)).toBeVisible();
  policy.fields.forEach((field) => expect(screen.queryByText(field)).not.toBeInTheDocument());
  expect(screen.queryByText(/Al radicar, el sistema registra/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  fireEvent.click(checkbox);
  expect(checkbox).toBeChecked();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ accepted: true, version: 'v1', policyHash: 'abc123', clientAcceptedAt: expect.any(String) }));
  fireEvent.click(checkbox);
  expect(onChange).toHaveBeenLastCalledWith(null);
  expect(screen.getByRole('alert')).toHaveTextContent('Debe aceptar');
});

test('impide aceptar si no se carga el oficio y permite reintentar', async () => {
  reporteSalidaService.getConfig.mockRejectedValueOnce(new Error('sin conexión'));
  reporteSalidaService.getConfig.mockResolvedValueOnce({ data: { consentimientoSalud: policy } });
  render(<ConsentimientoSalud value={null} onChange={jest.fn()} />);
  expect(await screen.findByText(/No se pudo cargar/)).toBeVisible();
  expect(screen.getByRole('checkbox')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  await waitFor(() => expect(screen.getByRole('checkbox')).toBeEnabled());
});
