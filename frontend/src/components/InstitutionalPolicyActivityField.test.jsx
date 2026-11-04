import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Field, { availablePolicyLines } from './InstitutionalPolicyActivityField';
import service from '../services/institutionalPolicyService';
jest.mock('../services/institutionalPolicyService', () => ({ list: jest.fn() }));
const policies = [{ name: 'A', actionLines: ['Primera', 'Compartida'] }, { name: 'B', actionLines: ['Segunda', 'Compartida'] }];
beforeEach(() => {
  service.list.mockResolvedValue(policies);
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, top: 0, left: 0, right: 300, bottom: 50, width: 300, height: 50 });
});
afterEach(() => jest.restoreAllMocks());
test('shows all unique lines without a policy and filters by selected policy', () => {
  expect(availablePolicyLines(policies, '')).toEqual(['Primera', 'Compartida', 'Segunda']);
  expect(availablePolicyLines(policies, 'B')).toEqual(['Segunda', 'Compartida']);
});
test('refreshes the shared catalog on focus without replacing activity values', async () => {
  const onChange = jest.fn();
  render(<Field field={{ key: 'institutional_policy', label: 'Política', validation_rules: { role: 'policy', policy_key: 'institutional_policy' } }} values={{ institutional_policy: 'A' }} onChange={onChange} />);
  await waitFor(() => expect(service.list).toHaveBeenCalledTimes(1));
  service.list.mockResolvedValue([...policies, { name: 'Nueva política', actionLines: ['Nueva línea'] }]);
  fireEvent.focus(window);
  await waitFor(() => expect(service.list).toHaveBeenCalledTimes(2));
  const input = screen.getByRole('combobox');
  fireEvent.change(input, { target: { value: 'Nueva' } });
  expect(await screen.findByRole('option', { name: 'Nueva política' })).toBeTruthy();
  expect(onChange).not.toHaveBeenCalled();
});
test('allows writing a new action line without changing the central catalog', async () => {
  const onChange = jest.fn();
  render(<Field field={{ key: 'institutional_policy_lines', label: 'Líneas', validation_rules: { role: 'lines', policy_key: 'institutional_policy' } }} values={{ institutional_policy: 'A' }} onChange={onChange} />);
  await waitFor(() => expect(service.list).toHaveBeenCalled());
  const input = screen.getByRole('combobox');
  fireEvent.change(input, { target: { value: 'Nueva línea' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(onChange).toHaveBeenCalledWith({ institutional_policy_lines: ['Nueva línea'] });
});
test('changing policy discards lines belonging to the previous policy', async () => {
  const onChange = jest.fn();
  render(<Field field={{ key: 'institutional_policy', label: 'Política', validation_rules: { role: 'policy', policy_key: 'institutional_policy' } }} values={{ institutional_policy: 'A', institutional_policy_lines: ['Primera', 'Compartida'] }} onChange={onChange} />);
  const input = screen.getByRole('combobox');
  fireEvent.change(input, { target: { value: 'B' } });
  fireEvent.click(await screen.findByRole('option', { name: 'B' }));
  expect(onChange).toHaveBeenCalledWith({ institutional_policy: 'B', institutional_policy_lines: ['Compartida'] });
});
