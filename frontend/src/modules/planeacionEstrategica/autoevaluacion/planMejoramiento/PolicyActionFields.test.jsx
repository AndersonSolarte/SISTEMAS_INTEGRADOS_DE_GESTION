import React, { useState } from 'react';
import { act, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PolicyActionFields from './PolicyActionFields';

beforeEach(() => {
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, top: 0, left: 0, right: 300, bottom: 50, width: 300, height: 50, toJSON: () => ({}) });
});
afterEach(() => jest.restoreAllMocks());

test('keyword results and query remain while selecting lines across policies and every owner is added', async () => {
  const catalog = [
    { name: 'Política Curricular', actionLines: ['Diseño curricular', 'Evaluación'] },
    { name: 'Política Docente', actionLines: ['Desarrollo curricular'] },
    { name: 'Política Académica', actionLines: ['Mejoramiento curricular'] }
  ];
  function SearchForm() {
    const [names, setNames] = useState(['Política Curricular']);
    const [lines, setLines] = useState([]);
    return <><PolicyActionFields policies={catalog} selectedPolicies={names} selectedLines={lines} onPolicyChange={setNames} onLinesChange={setLines} />
      <output data-testid="policies">{names.join('|')}</output><output data-testid="lines">{lines.join('|')}</output></>;
  }
  render(<SearchForm />);
  const input = screen.getByRole('combobox', { name: 'Líneas de acción' });
  fireEvent.change(input, { target: { value: 'curricular' } });
  fireEvent.mouseDown(input);
  expect(await screen.findAllByRole('option')).toHaveLength(3);
  fireEvent.click(screen.getByRole('option', { name: 'Diseño curricular' }));
  expect(input).toHaveValue('curricular');
  expect(screen.getAllByRole('option')).toHaveLength(3);
  fireEvent.click(screen.getByRole('option', { name: 'Desarrollo curricular' }));
  expect(input).toHaveValue('curricular');
  expect(screen.getAllByRole('option')).toHaveLength(3);
  fireEvent.click(screen.getByRole('option', { name: 'Mejoramiento curricular' }));
  expect(screen.getByTestId('lines')).toHaveTextContent('Diseño curricular|Desarrollo curricular|Mejoramiento curricular');
  expect(screen.getByTestId('policies')).toHaveTextContent('Política Curricular|Política Docente|Política Académica');
  expect(input).toHaveValue('curricular');
});

const policies = [
  { name: 'Política de Calidad', actionLines: ['Mejora continua', 'Evaluación'] },
  { name: 'Política de Bienestar', actionLines: ['Atención integral'] }
];

function Form({ refresh = jest.fn(), initialPolicy = [] }) {
  const [policy, setPolicy] = useState(initialPolicy);
  const [lines, setLines] = useState([]);
  return <><PolicyActionFields policies={policies} selectedPolicies={policy} selectedLines={lines}
    onPolicyChange={(value) => { setPolicy(value); setLines([]); }} onLinesChange={setLines} onRefresh={refresh} />
    <output data-testid="selection">{lines.join(',')}</output></>;
}

test('selecting one policy immediately opens only its action lines beside it', async () => {
  const refresh = jest.fn(async () => {});
  render(<Form refresh={refresh} />);
  expect(screen.getByRole('combobox', { name: 'Líneas de acción' })).toBeEnabled();
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Políticas institucionales' }));
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

test('multiple policies show their combined lines and preserve both selections', async () => {
  render(<Form initialPolicy={['Política de Calidad', 'Política de Bienestar']} />);
  expect(screen.getByText('Política de Calidad')).toBeInTheDocument();
  expect(screen.getByText('Política de Bienestar')).toBeInTheDocument();
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Líneas de acción' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Mejora continua' }));
  fireEvent.click(screen.getByRole('option', { name: 'Atención integral' }));
  expect(screen.getByTestId('selection')).toHaveTextContent('Mejora continua,Atención integral');
});

test('a second policy can be added without replacing the first', async () => {
  render(<Form initialPolicy={['Política de Calidad']} />);
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Políticas institucionales' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Política de Bienestar' }));
  expect(screen.getByText('Política de Calidad')).toBeInTheDocument();
  expect(screen.getByText('Política de Bienestar')).toBeInTheDocument();
  expect(await screen.findByRole('option', { name: 'Mejora continua' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Atención integral' })).toBeInTheDocument();
});

test('lines from different policies automatically select every owner and retain earlier lines', async () => {
  render(<Form />);
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Líneas de acción' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Mejora continua' }));
  expect(screen.getByText('Política de Calidad')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('option', { name: 'Atención integral' }));
  expect(screen.getByText('Política de Calidad')).toBeInTheDocument();
  expect(screen.getByText('Política de Bienestar')).toBeInTheDocument();
  expect(screen.getByTestId('selection')).toHaveTextContent('Mejora continua,Atención integral');
  fireEvent.click(screen.getByRole('option', { name: 'Mejora continua' }));
  expect(screen.queryByText('Política de Calidad')).not.toBeInTheDocument();
  expect(screen.getByText('Política de Bienestar')).toBeInTheDocument();
});

test('one shared line automatically selects all its policies', async () => {
  function SharedForm() {
    const [names, setNames] = useState([]);
    const [lines, setLines] = useState([]);
    return <PolicyActionFields policies={[...policies, { name: 'Política adicional', actionLines: ['Atención integral'] }]} selectedPolicies={names} selectedLines={lines} onPolicyChange={setNames} onLinesChange={setLines} />;
  }
  render(<SharedForm />);
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Líneas de acción' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Atención integral' }));
  expect(screen.getByText('Política de Bienestar')).toBeInTheDocument();
  expect(screen.getByText('Política adicional')).toBeInTheDocument();
});

test('selecting a line first restricts policies to its owners', async () => {
  render(<Form />);
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Líneas de acción' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Atención integral' }));
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Líneas de acción' }), { key: 'Escape' });
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Políticas institucionales' }));
  expect(await screen.findByRole('option', { name: 'Política de Bienestar' })).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: 'Política de Calidad' })).not.toBeInTheDocument();
});

test('shared action lines offer every matching policy from the central catalog', async () => {
  render(<PolicyActionFields policies={[...policies, { name: 'Política adicional', actionLines: ['Atención integral'] }]} selectedLines={['Atención integral']} onPolicyChange={jest.fn()} onLinesChange={jest.fn()} />);
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Políticas institucionales' }));
  expect(await screen.findByRole('option', { name: 'Política de Bienestar' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Política adicional' })).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: 'Política de Calidad' })).not.toBeInTheDocument();
});

test('clearing line selection restores the complete policy catalog', async () => {
  const props = { onPolicyChange: jest.fn(), onLinesChange: jest.fn(), policies };
  const { rerender } = render(<PolicyActionFields {...props} selectedLines={['Atención integral']} />);
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Políticas institucionales' }));
  expect(await screen.findByRole('option', { name: 'Política de Bienestar' })).toBeInTheDocument();
  rerender(<PolicyActionFields {...props} selectedLines={[]} />);
  expect(await screen.findByRole('option', { name: 'Política de Calidad' })).toBeInTheDocument();
});

test('automatically opened lines close on outside click without losing selected lines', async () => {
  render(<><Form /><button>Fuera</button></>);
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Políticas institucionales' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Política de Calidad' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Mejora continua' }));
  expect(screen.getByRole('listbox')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Fuera' }));
  await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  expect(screen.getByTestId('selection')).toHaveTextContent('Mejora continua');
});

test('Escape closes automatically opened lines while policy input still has focus', async () => {
  render(<Form />);
  const input = screen.getByRole('combobox', { name: 'Políticas institucionales' });
  fireEvent.mouseDown(input);
  fireEvent.click(await screen.findByRole('option', { name: 'Política de Calidad' }));
  expect(await screen.findByRole('listbox')).toBeInTheDocument();
  fireEvent.keyDown(input, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
});
test('shows every catalog line when no policy is selected and picks up new data', async () => {
  const props = { selectedPolicies: [], selectedLines: [], onPolicyChange: jest.fn(), onLinesChange: jest.fn() };
  const { rerender } = render(<PolicyActionFields {...props} policies={policies} />);
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Líneas de acción' }));
  expect(await screen.findByRole('option', { name: 'Mejora continua' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Atención integral' })).toBeInTheDocument();
  rerender(<PolicyActionFields {...props} policies={[...policies, { name: 'Nueva', actionLines: ['Nueva línea institucional'] }]} />);
  expect(await screen.findByRole('option', { name: 'Nueva línea institucional' })).toBeInTheDocument();
});

test('policies missing from the central catalog cannot be created from Improvement', async () => {
  render(<Form />);
  const input = screen.getByRole('combobox', { name: 'Políticas institucionales' });
  await act(async () => {
    fireEvent.change(input, { target: { value: 'Nueva política' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 13 });
  });
  expect(screen.getByRole('combobox', { name: 'Líneas de acción' })).toBeEnabled();
  expect(screen.getByTestId('selection')).toHaveTextContent('');
});

test('new action lines cannot be created from Improvement', () => {
  render(<Form initialPolicy={['Política de Bienestar']} />);
  const input = screen.getByRole('combobox', { name: 'Líneas de acción' });
  fireEvent.change(input, { target: { value: 'Nueva línea' } });
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 13 });
  expect(screen.getByTestId('selection')).toHaveTextContent('');
});

test('saved policy names in uppercase still resolve to their own catalog lines', async () => {
  render(<Form initialPolicy={['POLITICA DE BIENESTAR']} />);
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Líneas de acción' }));
  expect(await screen.findByRole('option', { name: 'Atención integral' })).toBeInTheDocument();
});
