import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ActivityResourceField, { parseResources } from './ActivityResourceField';

beforeEach(() => jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, top: 0, left: 0, right: 300, bottom: 50, width: 300, height: 50, toJSON: () => ({}) }));
afterEach(() => jest.restoreAllMocks());

test('selects multiple resource categories and stores them in the existing Excel-compatible field', async () => {
  function Form() {
    const [value, setValue] = useState('');
    return <><ActivityResourceField value={value} onChange={setValue} /><output data-testid="stored">{value}</output></>;
  }
  render(<Form />);
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Recursos' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Financieros' }));
  fireEvent.click(screen.getByRole('option', { name: 'Humanos' }));
  expect(screen.getByTestId('stored')).toHaveTextContent('Financieros; Humanos');
  expect(screen.getAllByRole('option')).toHaveLength(4);
});

test('retains legacy resources and normalizes saved category names', () => {
  expect(parseResources('200000')).toEqual(['200000']);
  expect(parseResources('fisicos; TECNOLOGICOS; físicos')).toEqual(['Físicos', 'Tecnológicos']);
  expect(parseResources('')).toEqual([]);
});
