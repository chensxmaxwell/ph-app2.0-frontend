export const ANONYMOUS_USER_NAME = "Anonymous User";

export type SessionUser = {
  id?: string;
  email?: string;
  token?: string;
  name?: string;
  nickName?: string;
};

export const isBypassUser = (user?: SessionUser | null) => {
  if (!user) {
    return false;
  }
  return (
    user.id === "bypass" ||
    user.email === "bypass@local" ||
    user.token === "bypass"
  );
};

export const resolveHomeDisplayName = ({
  user,
  profileName,
}: {
  user?: SessionUser | null;
  profileName?: string | null;
}) => {
  if (isBypassUser(user)) {
    return ANONYMOUS_USER_NAME;
  }
  const fromProfile = profileName?.trim();
  if (fromProfile) {
    return fromProfile;
  }
  const fromUser = user?.name?.trim() || user?.nickName?.trim();
  if (fromUser) {
    return fromUser;
  }
  return ANONYMOUS_USER_NAME;
};
