import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import PendingAspectFields from './PendingAspectFields';
import { pendingAspects } from './aspectIdentity';

const first = { id: 1, factor: 'F1', caracteristica: 'C1', aspecto: 'A1' };
const second = { id: 2, factor: 'F1', caracteristica: 'C2', aspecto: 'A2' };
const third = { id: 3, factor: 'F2', caracteristica: 'C3', aspecto: 'A3' };
const all = [first, second, third];
const handlers = { onFactorChange: jest.fn(), onCharacteristicChange: jest.fn() };

test('keeps the saved characteristic visible but hides it from choices when exhausted', () => {
  render(<PendingAspectFields {...handlers} pending={pendingAspects(all, [{ aspectosAutoevaluacion: [first] }])} factor="F1" characteristic="C1" />);
  expect(screen.getByLabelText('Característica')).toHaveTextContent('C1');
  fireEvent.mouseDown(screen.getByLabelText('Característica'));
  expect(screen.queryByRole('option', { name: 'C1' })).not.toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'C2' })).toBeInTheDocument();
});

test('hides a factor only when all its characteristics are exhausted', () => {
  render(<PendingAspectFields {...handlers} pending={pendingAspects(all, [{ aspectosAutoevaluacion: [first, second] }])} factor="F1" characteristic="C1" />);
  expect(screen.getByLabelText('Factor / condición')).toHaveTextContent('F1');
  fireEvent.mouseDown(screen.getByLabelText('Factor / condición'));
  expect(screen.queryByRole('option', { name: 'F1' })).not.toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'F2' })).toBeInTheDocument();
});

test('disables empty selectors for a new objective when every aspect is assigned', () => {
  render(<PendingAspectFields {...handlers} pending={pendingAspects(all, [{ aspectosAutoevaluacion: all }])} />);
  expect(screen.getByLabelText('Factor / condición')).toHaveAttribute('aria-disabled', 'true');
  expect(screen.getByLabelText('Característica')).toHaveAttribute('aria-disabled', 'true');
});
