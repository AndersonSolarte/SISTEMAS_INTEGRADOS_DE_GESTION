import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ObjectiveAccordion from './ObjectiveAccordion';

test('collapses the objective without losing edits and keeps deletion separate', () => {
  const remove = jest.fn();
  render(<ObjectiveAccordion number={2} imported onRemove={remove}><input aria-label="Objetivo" defaultValue="Inicial" /></ObjectiveAccordion>);
  expect(screen.getByRole('button', { name: 'Expandir objetivo 2' })).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(screen.getByRole('button', { name: 'Expandir objetivo 2' }));
  fireEvent.change(screen.getByLabelText('Objetivo'), { target: { value: 'Objetivo editado' } });
  fireEvent.click(screen.getByRole('button', { name: 'Contraer objetivo 2' }));
  expect(screen.getByRole('button', { name: 'Expandir objetivo 2' })).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(screen.getByRole('button', { name: 'Expandir objetivo 2' }));
  expect(screen.getByLabelText('Objetivo')).toHaveValue('Objetivo editado');
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar objetivo 2' }));
  expect(remove).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Contraer objetivo 2' })).toHaveAttribute('aria-expanded', 'true');
});
