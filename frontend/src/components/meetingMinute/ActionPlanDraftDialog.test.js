import React from 'react';
import { act, fireEvent, render, screen, cleanup } from '@testing-library/react';
import ActionPlanDraftDialog from './ActionPlanDraftDialog';
import meetingMinuteService from '../../services/meetingMinuteService';
jest.mock('react-router-dom', () => ({ useLocation: () => ({ pathname: '/dashboard', search: '?planMinute=shared' }), useNavigate: () => jest.fn() }));
jest.mock('../../services/meetingMinuteService', () => ({ getActionPlanDraft: jest.fn(), listActionPlanDrafts: jest.fn(), updateActionPlanDraft: jest.fn() }));
jest.mock('./RichTextEditor', () => ({ __esModule: true, default: ({ label, value, onChange }) => <textarea aria-label={label} value={value} onChange={e => onChange(e.target.value)} />, sanitizeRichHtml: html => html }));
const row = { id: 'shared', status: 'draft', title: 'Shared minute', objective: 'Original', commitments: [], actionPlan: { code: '2026-R75' }, participants: [], minuteVersions: [{ status: 'draft' }], updated_at: '2026-01-01T00:00:00Z' };
const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };
beforeEach(() => { jest.useFakeTimers(); meetingMinuteService.listActionPlanDrafts.mockResolvedValue({ data: [] }); meetingMinuteService.getActionPlanDraft.mockResolvedValue({ data: row }); });
afterEach(() => { cleanup(); jest.useRealTimers(); jest.clearAllMocks(); });
test('autosaves only the changed field against the version actually read', async () => {
  meetingMinuteService.updateActionPlanDraft.mockResolvedValue({ data: { ...row, objective: 'Coauthor edit', updated_at: '2026-01-01T00:00:01Z' } });
  render(<ActionPlanDraftDialog />); await flush();
  fireEvent.change(screen.getByLabelText('Objetivo'), { target: { value: 'Coauthor edit' } });
  await act(async () => { jest.advanceTimersByTime(1300); });
  expect(meetingMinuteService.updateActionPlanDraft).toHaveBeenCalledWith('shared', { expected_updated_at: row.updated_at, changes: { objective: 'Coauthor edit' } });
});
test('a concurrent-write conflict preserves the local text and stops automatic retries', async () => {
  meetingMinuteService.updateActionPlanDraft.mockRejectedValue({ response: { status: 409, data: { message: 'Conflict: text preserved' } } });
  render(<ActionPlanDraftDialog />); await flush();
  fireEvent.change(screen.getByLabelText('Objetivo'), { target: { value: 'My pending text' } });
  await act(async () => { jest.advanceTimersByTime(1300); });
  expect(screen.getByLabelText('Objetivo').value).toBe('My pending text');
  await act(async () => { jest.advanceTimersByTime(6000); });
  expect(meetingMinuteService.updateActionPlanDraft).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Conflict: text preserved')).toBeTruthy();
});
test('a remote clean draft refreshes automatically and signing disables editing', async () => {
  render(<ActionPlanDraftDialog />); await flush();
  meetingMinuteService.getActionPlanDraft.mockResolvedValue({ data: { ...row, objective: 'Remote edit' } });
  await act(async () => { jest.advanceTimersByTime(3000); });
  expect(screen.getByLabelText('Objetivo').value).toBe('Remote edit');
  meetingMinuteService.getActionPlanDraft.mockResolvedValue({ data: { ...row, minuteVersions: [{ status: 'signing' }] } });
  await act(async () => { jest.advanceTimersByTime(3000); });
  expect(screen.queryByLabelText('Objetivo')).toBeNull();
  expect(screen.getByText('Guardar cambios').disabled).toBe(true);
});
