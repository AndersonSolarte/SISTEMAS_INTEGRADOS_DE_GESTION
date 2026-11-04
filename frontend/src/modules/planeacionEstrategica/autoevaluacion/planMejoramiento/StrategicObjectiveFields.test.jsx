import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import StrategicObjectiveFields from './StrategicObjectiveFields';

beforeEach(() => jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, top: 0, left: 0, right: 300, bottom: 50, width: 300, height: 50, toJSON: () => ({}) }));
afterEach(() => jest.restoreAllMocks());

const line = (id, code, name) => ({ id, code, name, label: `${code} ${name}` });
const relations = [
  { ...line('o1', 'OE1', 'Primero'), guidelines: [line('g1', 'LE-001', 'Único')] },
  { ...line('o2', 'OE2', 'Segundo'), guidelines: [line('g2', 'LE-002', 'Segundo A'), line('g3', 'LE-003', 'Segundo B')] }
];
function Form({ initialObjective = '', initialGuideline = '' }) {
  const [objective, setObjective] = useState(initialObjective);
  const [guideline, setGuideline] = useState(initialGuideline);
  return <StrategicObjectiveFields relations={relations} objective={objective} guideline={guideline}
    onObjectiveChange={(value, nextLine) => { setObjective(value); setGuideline(nextLine); }} onGuidelineChange={setGuideline} />;
}

test('choosing an objective automatically selects its only guideline', async () => {
  render(<Form />);
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Objetivo estratégico' }));
  fireEvent.click(await screen.findByRole('option', { name: 'OE1 Primero' }));
  expect(screen.getByRole('combobox', { name: 'Lineamiento estratégico' })).toHaveValue('LE-001 Único');
});

test('changing objectives clears the old guideline and offers only related ones', async () => {
  render(<Form initialObjective="OE1 Primero" initialGuideline="LE-001 Único" />);
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Objetivo estratégico' }));
  fireEvent.click(await screen.findByRole('option', { name: 'OE2 Segundo' }));
  const field = screen.getByRole('combobox', { name: 'Lineamiento estratégico' });
  await waitFor(() => expect(field).toHaveValue(''));
  fireEvent.mouseDown(field);
  expect(await screen.findByRole('option', { name: 'LE-002 Segundo A' })).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: 'LE-001 Único' })).not.toBeInTheDocument();
});

test('old objective labels resolve by code without offering an unrelated saved guideline', () => {
  render(<Form initialObjective="OE2_Texto antiguo" initialGuideline="LE-001 Único" />);
  expect(screen.getByRole('combobox', { name: 'Objetivo estratégico' })).toHaveValue('OE2 Segundo');
  expect(screen.getByRole('combobox', { name: 'Lineamiento estratégico' })).toHaveValue('');
});
