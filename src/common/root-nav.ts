import { SCREENS } from "./constant";

type ResetNav = {
  getParent?: () => ResetNav | undefined;
  reset: (state: { index: number; routes: { name: never }[] }) => void;
};

export const rootOf = <T extends ResetNav>(navigation: T): T => {
  let current = navigation;
  let parent = navigation.getParent?.();
  while (parent) {
    current = parent as T;
    parent = current.getParent?.();
  }
  return current;
};

export const resetRoot = (navigation: ResetNav, name: string) => {
  const root = navigation.getParent?.() ?? navigation;
  root.reset({
    index: 0,
    routes: [{ name: name as never }],
  });
};

export const resetToMain = (navigation: ResetNav) =>
  resetRoot(navigation, SCREENS.MAIN);

export const resetToAuth = (navigation: ResetNav) =>
  resetRoot(navigation, SCREENS.AUTH);
