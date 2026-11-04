export const canApplyTrackingRefresh = ({ focused, pending, revision, requestRevision, snapshot, savedSnapshot }) =>
  !focused && !pending && revision === requestRevision && snapshot === savedSnapshot;
