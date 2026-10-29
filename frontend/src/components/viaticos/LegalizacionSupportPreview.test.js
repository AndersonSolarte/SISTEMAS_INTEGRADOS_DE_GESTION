import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import LegalizacionSupportPreview from './LegalizacionSupportPreview';
import { obtenerAdjuntoLegalizacion } from '../../services/legalizacionViaticosService';

jest.mock('../../services/legalizacionViaticosService', () => ({ obtenerAdjuntoLegalizacion: jest.fn() }));
const document = { legalizacionId: 30, support: { id: '7', originalName: 'SEVEN.pdf', mimetype: 'application/pdf' } };

beforeEach(() => {
  URL.createObjectURL = jest.fn(() => 'blob:seven-preview');
  URL.revokeObjectURL = jest.fn();
});

test('abre el PDF dentro de SIAC y libera la vista previa al cerrar', async () => {
  obtenerAdjuntoLegalizacion.mockResolvedValue(new Blob(['%PDF-test'], { type: 'application/pdf' }));
  const open = jest.spyOn(window, 'open').mockImplementation(() => null);
  const { rerender } = render(<LegalizacionSupportPreview document={document} onClose={() => {}} />);
  expect(await screen.findByTitle('Vista previa de SEVEN.pdf')).toHaveAttribute('src', 'blob:seven-preview#toolbar=1');
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(open).not.toHaveBeenCalled();
  const signal = obtenerAdjuntoLegalizacion.mock.calls[0][2];
  rerender(<LegalizacionSupportPreview document={null} onClose={() => {}} />);
  await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:seven-preview'));
  expect(signal.aborted).toBe(true);
  open.mockRestore();
});

test('una respuesta tardía después del cierre no crea un visor ni deja un archivo en memoria', async () => {
  let resolve;
  obtenerAdjuntoLegalizacion.mockImplementation(() => new Promise((done) => { resolve = done; }));
  const { unmount } = render(<LegalizacionSupportPreview document={document} onClose={() => {}} />);
  unmount();
  resolve(new Blob(['%PDF-test'], { type: 'application/pdf' }));
  await waitFor(() => expect(obtenerAdjuntoLegalizacion).toHaveBeenCalled());
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});
