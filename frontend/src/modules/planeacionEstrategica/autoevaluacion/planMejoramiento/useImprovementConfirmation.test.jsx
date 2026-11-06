import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import useImprovementConfirmation from './useImprovementConfirmation';

function Form({ onResult, kind = 'unlink' }) {
  const { confirm, dialog } = useImprovementConfirmation();
  const open = async () => {
    const accepted = await confirm({ kind, title: kind === 'delete' ? 'Eliminar plan' : 'Desvincular actividad', name: 'Generar reportes', context: 'PLAN-2026', description: 'Se retirará el vínculo con el Plan de Acción.', confirmLabel: kind === 'delete' ? 'Eliminar plan' : 'Desvincular' });
    onResult(accepted);
  };
  return <>{dialog}<button onClick={open}>Abrir</button></>;
}

test('confirmation displays the activity and destination and accepts only an explicit action', async () => {
  const result = jest.fn();
  render(<Form onResult={result} />);
  fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
  expect(await screen.findByRole('alertdialog', { name: 'Desvincular actividad' })).toBeInTheDocument();
  expect(screen.getByText('Generar reportes')).toBeInTheDocument();
  expect(screen.getByText('PLAN-2026')).toBeInTheDocument();
  expect(result).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Desvincular' }));
  await waitFor(() => expect(result).toHaveBeenCalledWith(true));
});

test('cancel and Escape dismiss the dialog without accepting', async () => {
  const result = jest.fn();
  render(<Form onResult={result} />);
  fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
  await waitFor(() => expect(result).toHaveBeenLastCalledWith(false));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
  fireEvent.keyDown(await screen.findByRole('alertdialog'), { key: 'Escape' });
  await waitFor(() => expect(result).toHaveBeenCalledTimes(2));
  expect(result).toHaveBeenLastCalledWith(false);
});

test('delete uses its own explicit confirmation label', async () => {
  const result = jest.fn();
  render(<Form onResult={result} kind="delete" />);
  fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Eliminar plan' }));
  await waitFor(() => expect(result).toHaveBeenCalledWith(true));
});
