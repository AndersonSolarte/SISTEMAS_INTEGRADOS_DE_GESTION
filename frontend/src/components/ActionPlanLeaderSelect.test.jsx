import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ActionPlanLeaderSelect from './ActionPlanLeaderSelect';
import strategicPlanningService from '../services/strategicPlanningService';
jest.mock('../services/strategicPlanningService', () => ({ leaderOptions: jest.fn() }));
const user = { id: 1, name: 'José Pérez', document: '1234', position: 'Director', email: 'jose@example.com' };
afterEach(() => { jest.restoreAllMocks(); jest.clearAllMocks(); });
test('a failed users request does not visually clear the stored responsible and allows explicit removal', async () => {
  strategicPlanningService.leaderOptions.mockRejectedValue(new Error('offline'));
  const onChange = jest.fn();
  render(<ActionPlanLeaderSelect planId="ped" value={1} currentLeader={user} onChange={onChange} />);
  expect(screen.getByRole('combobox').value).toContain('José Pérez');
  expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeTruthy();
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Retirar responsable' }));
  expect(onChange).toHaveBeenCalledWith(null);
});
test('retry reloads users, and search matches names without accents', async () => {
  strategicPlanningService.leaderOptions.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ data: [user] });
  const onChange = jest.fn(); const onOptionsLoaded = jest.fn();
  render(<ActionPlanLeaderSelect planId="ped" value={null} onChange={onChange} onOptionsLoaded={onOptionsLoaded} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
  await waitFor(() => expect(onOptionsLoaded).toHaveBeenCalledWith([user]));
  const input = screen.getByRole('combobox');
  const anchor = input.closest('.MuiInputBase-root');
  jest.spyOn(anchor, 'getBoundingClientRect').mockReturnValue({ x: 10, y: 10, top: 10, left: 10, right: 310, bottom: 50, width: 300, height: 40, toJSON: () => ({}) });
  fireEvent.change(input, { target: { value: 'JOSE' } });
  fireEvent.click(await screen.findByRole('option', { name: /José Pérez/ }));
  expect(onChange).toHaveBeenCalledWith(user);
});
test('a missing options list still shows a removable value instead of a misleading blank', async () => {
  strategicPlanningService.leaderOptions.mockResolvedValue({ data: [] });
  render(<ActionPlanLeaderSelect planId="ped" value={50} onChange={jest.fn()} />);
  expect(screen.getByRole('combobox').value).toContain('ID 50');
  expect(await screen.findByRole('button', { name: 'Retirar responsable' })).toBeTruthy();
});
