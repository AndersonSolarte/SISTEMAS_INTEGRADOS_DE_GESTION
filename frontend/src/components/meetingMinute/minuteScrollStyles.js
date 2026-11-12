// Shared by both minute editors and their previews.
export const minuteScrollStyles = {
  scrollbarGutter: 'stable',
  scrollbarWidth: 'auto',
  // Chromium must use the explicit scrollbar dimensions below.
  scrollbarColor: 'auto',
  '@supports not selector(::-webkit-scrollbar)': { scrollbarColor: '#475569 #e2e8f0' },
  '&::-webkit-scrollbar': { width: '14px', height: '14px' },
  '&::-webkit-scrollbar-track': { backgroundColor: '#e2e8f0', border: '1px solid #94a3b8', borderRadius: '10px' },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: '#475569', border: '2px solid #e2e8f0', borderRadius: '10px', minHeight: '48px',
    '&:hover': { backgroundColor: '#1e293b' },
    '&:active': { backgroundColor: '#1d4ed8' }
  }
};
