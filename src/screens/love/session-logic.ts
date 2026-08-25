export const shouldReuseLoveChat = ({
  currentCompanionId,
  nextCompanionId,
  replace,
}: {
  currentCompanionId?: string;
  nextCompanionId?: string;
  replace?: boolean;
}) => {
  if (replace) {
    return false;
  }
  if (!nextCompanionId || !currentCompanionId) {
    return false;
  }
  return currentCompanionId === nextCompanionId;
};
