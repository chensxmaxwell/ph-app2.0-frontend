export const enterTalkMode = (input: {
  dismissKeyboard: () => void;
  blurInput: () => void;
  setDrawerOpen: (open: boolean) => void;
  setTalkMode: (open: boolean) => void;
}) => {
  input.setDrawerOpen(false);
  input.blurInput();
  input.dismissKeyboard();
  input.setTalkMode(true);
};

export const leaveTalkMode = (input: {
  setTalkMode: (open: boolean) => void;
  setHolding: (holding: boolean) => void;
}) => {
  input.setHolding(false);
  input.setTalkMode(false);
};
