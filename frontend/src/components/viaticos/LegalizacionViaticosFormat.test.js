import React from 'react';
import { render, screen } from '@testing-library/react';
import LegalizacionViaticosFormat from './LegalizacionViaticosFormat';

const support = { id: '1', conceptoId: 'gasto', originalName: 'factura.pdf' };
const legalizacion = { estado: 'en_revision', detalles: [{ id: 'gasto', detalle: 'Manutención', valorAnticipo: 100000, valorLegalizado: 90000 }], adjuntos: [support] };

test('el administrador puede consultar el soporte temporal durante la revisión', () => {
  render(<LegalizacionViaticosFormat solicitud={{}} legalizacion={legalizacion} mode="manager" />);
  expect(screen.getByRole('button', { name: 'factura.pdf' })).toBeEnabled();
});

test('al cerrar mantiene los datos y comunica la custodia en correo sin ofrecer una descarga inexistente', () => {
  render(<LegalizacionViaticosFormat solicitud={{}} legalizacion={{ ...legalizacion, estado: 'finalizada', adjuntos: [{ ...support, persistidoEnBaseDatos: false, disponibleEnCorreo: true }] }} mode="manager" />);
  expect(screen.getByRole('button', { name: 'factura.pdf · Entregado por correo' })).toBeDisabled();
  expect(screen.getByText(/Los documentos y soportes finales fueron entregados por correo institucional/)).toBeInTheDocument();
  expect(screen.getByText('Manutención')).toBeInTheDocument();
});
