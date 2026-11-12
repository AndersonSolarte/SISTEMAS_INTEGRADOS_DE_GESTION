// Shared by both minute editors and their previews.
export const minuteScrollStyles = {
  scrollbarGutter: 'stable',
  scrollbarWidth: 'auto',
  scrollbarColor: '#475569 #e2e8f0',
  '&::-webkit-scrollbar': { width: '20px', height: '20px' },
  '&::-webkit-scrollbar-track': { backgroundColor: '#e2e8f0', border: '1px solid #94a3b8', borderRadius: '10px' },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: '#475569', border: '3px solid #e2e8f0', borderRadius: '10px', minHeight: '48px',
    '&:hover': { backgroundColor: '#1e293b' },
    '&:active': { backgroundColor: '#1d4ed8' }
  }
};
