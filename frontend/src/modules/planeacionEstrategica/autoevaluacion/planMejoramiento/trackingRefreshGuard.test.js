import { canApplyTrackingRefresh } from './trackingRefreshGuard';

const clean = { focused: false, pending: false, revision: 1, requestRevision: 1, snapshot: '100', savedSnapshot: '100' };

test('the five second refresh never replaces the focused input, even after autosave', () => {
  jest.useFakeTimers();
  let value = 100;
  const timer = setInterval(() => {
    if (canApplyTrackingRefresh({ ...clean, focused: true })) value = 70;
  }, 5000);
  jest.advanceTimersByTime(15000);
  expect(value).toBe(100);
  clearInterval(timer);
  jest.useRealTimers();
});

test('a response started before an edit or save is discarded even if autosave finished', () => {
  expect(canApplyTrackingRefresh({ ...clean, revision: 3 })).toBe(false);
});

test('unsaved changes and an in-flight save both block refresh', () => {
  expect(canApplyTrackingRefresh({ ...clean, snapshot: '100', savedSnapshot: '70' })).toBe(false);
  expect(canApplyTrackingRefresh({ ...clean, pending: true })).toBe(false);
});

test('updates resume when no field is focused and the latest edits are saved', () => {
  expect(canApplyTrackingRefresh(clean)).toBe(true);
});
