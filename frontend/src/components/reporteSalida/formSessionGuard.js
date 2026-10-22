export const resolveFormSession = (wasOpen, open) => {
  if (!open) {
    return {
      shouldInitialize: false,
      nextSession: false
    };
  }

  return {
    shouldInitialize: !wasOpen,
    nextSession: true
  };
};
