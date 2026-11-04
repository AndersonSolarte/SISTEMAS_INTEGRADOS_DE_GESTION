import React, { useState } from 'react';
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PolicyActionFields from './PolicyActionFields';

beforeEach(() => {
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, top: 0, left: 0, right: 300, bottom: 50, width: 300, height: 50, toJSON: () => ({}) });
});
afterEach(() => jest.restoreAllMocks());

const policies = [
  { name: 'Política de Calidad', actionLines: ['Mejora continua', 'Evaluación'] },
  { name: 'Política de Bienestar', actionLines: ['Atención integral'] }
];

function Form({ refresh = jest.fn(), initialPolicy = [], create }) {
  const [policy, setPolicy] = useState(initialPolicy);
  const [lines, setLines] = useState([]);
  const [catalog, setCatalog] = useState(policies);
  const add = async (name, actionLines) => {
    const result = create ? await create(name, actionLines) : { name, actionLines };
    setCatalog((previous) => [...previous.filter((item) => item.name !== name), result]);
    return result;
  };
  return <><PolicyActionFields policies={catalog} selectedPolicies={policy} selectedLines={lines}
    onPolicyChange={(value) => { setPolicy(value); setLines([]); }} onLinesChange={setLines} onRefresh={refresh} onCreate={add} />
    <output data-testid="selection">{lines.join(',')}</output></>;
}

test('selecting one policy immediately opens only its action lines beside it', async () => {
  const refresh = jest.fn(async () => {});
  render(<Form refresh={refresh} />);
  expect(screen.getByRole('combobox', { name: 'Líneas de acción' })).toBeDisabled();
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Política institucional' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Política de Calidad' }));
  expect(screen.getByRole('combobox', { name: 'Líneas de acción' })).toBeEnabled();
  const list = await screen.findByRole('listbox');
  expect(within(list).getByText('Mejora continua')).toBeInTheDocument();
  expect(within(list).getByText('Evaluación')).toBeInTheDocument();
  expect(within(list).queryByText('Atención integral')).not.toBeInTheDocument();
  fireEvent.click(within(list).getByText('Mejora continua'));
  expect(screen.getByTestId('selection')).toHaveTextContent('Mejora continua');
  expect(refresh).toHaveBeenCalled();
});

test('a previously saved policy shows its own lines when reopened', async () => {
  render(<Form initialPolicy={['Política de Bienestar']} />);
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Líneas de acción' }));
  expect(await screen.findByRole('option', { name: 'Atención integral' })).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: 'Mejora continua' })).not.toBeInTheDocument();
});

test('a saved policy absent from Excel remains available for adding its own lines', async () => {
  render(<Form initialPolicy={['POLÍTICA CURRICULAR']} />);
  expect(screen.getByRole('combobox', { name: 'Política institucional' })).toHaveValue('POLÍTICA CURRICULAR');
  expect(screen.getByRole('combobox', { name: 'Líneas de acción' })).toBeEnabled();
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Política institucional' }));
  expect(await screen.findByRole('option', { name: 'Política de Calidad' })).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: 'POLÍTICA CURRICULAR' })).not.toBeInTheDocument();
});

test('typing a new policy and line saves both to the reusable catalog', async () => {
  const create = jest.fn(async (name, actionLines) => ({ name, actionLines }));
  render(<Form create={create} />);
  const policy = screen.getByRole('combobox', { name: 'Política institucional' });
  fireEvent.change(policy, { target: { value: 'Política Curricular' } });
  fireEvent.keyDown(policy, { key: 'Enter', code: 'Enter', keyCode: 13 });
  await waitFor(() => expect(create).toHaveBeenCalledWith('Política Curricular', []));
  const line = screen.getByRole('combobox', { name: 'Líneas de acción' });
  await waitFor(() => expect(line).toBeEnabled());
  fireEvent.change(line, { target: { value: 'Actualizar los currículos' } });
  fireEvent.keyDown(line, { key: 'Enter', code: 'Enter', keyCode: 13 });
  await waitFor(() => expect(create).toHaveBeenCalledWith('Política Curricular', ['Actualizar los currículos']));
  await waitFor(() => expect(screen.getByTestId('selection')).toHaveTextContent('Actualizar los currículos'));
});

test('a failed catalog save shows the error and does not select an unsaved policy', async () => {
  render(<Form create={async () => { throw new Error('Unavailable'); }} />);
  const policy = screen.getByRole('combobox', { name: 'Política institucional' });
  fireEvent.change(policy, { target: { value: 'Nueva política' } });
  fireEvent.keyDown(policy, { key: 'Enter', code: 'Enter', keyCode: 13 });
  expect(await screen.findByText('No fue posible crear la política.')).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Líneas de acción' })).toBeDisabled();
});

test('saved policy names in uppercase still resolve to their own catalog lines', async () => {
  render(<Form initialPolicy={['POLITICA DE BIENESTAR']} />);
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Líneas de acción' }));
  expect(await screen.findByRole('option', { name: 'Atención integral' })).toBeInTheDocument();
});
