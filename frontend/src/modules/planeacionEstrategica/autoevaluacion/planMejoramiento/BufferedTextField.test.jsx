import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import BufferedTextField from './BufferedTextField';

beforeEach(() => jest.useFakeTimers());
afterEach(() => { jest.runOnlyPendingTimers(); jest.useRealTimers(); });

test('typing is immediate and rapid keystrokes produce one plan update', () => {
  const change = jest.fn();
  render(<BufferedTextField label="Objetivo" value="" onChange={change} />);
  const field = screen.getByLabelText('Objetivo');
  for (const value of ['P', 'Pl', 'Plan']) fireEvent.change(field, { target: { value } });
  expect(field).toHaveValue('Plan');
  expect(change).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(180));
  expect(change).toHaveBeenCalledTimes(1);
  expect(change.mock.calls[0][0].target.value).toBe('Plan');
});

test('blur commits the latest text before Save and does not duplicate the update', () => {
  const change = jest.fn();
  render(<BufferedTextField label="Objetivo" value="Anterior" onChange={change} />);
  const field = screen.getByLabelText('Objetivo');
  fireEvent.change(field, { target: { value: 'Nuevo' } });
  fireEvent.blur(field);
  expect(change.mock.calls[0][0].target.value).toBe('Nuevo');
  act(() => jest.advanceTimersByTime(500));
  expect(change).toHaveBeenCalledTimes(1);
});

test('refreshes do not erase pending typing; external changes apply after it is committed', () => {
  const change = jest.fn();
  const { rerender } = render(<BufferedTextField label="Objetivo" value="Inicial" onChange={change} />);
  const field = screen.getByLabelText('Objetivo');
  fireEvent.change(field, { target: { value: 'Editando' } });
  rerender(<BufferedTextField label="Objetivo" value="Refresco" onChange={change} />);
  expect(field).toHaveValue('Editando');
  fireEvent.blur(field);
  expect(change.mock.calls[0][0].target.value).toBe('Editando');
  rerender(<BufferedTextField label="Objetivo" value="Editando" onChange={change} />);
  rerender(<BufferedTextField label="Objetivo" value="Actualizado" onChange={change} />);
  expect(field).toHaveValue('Actualizado');
});
