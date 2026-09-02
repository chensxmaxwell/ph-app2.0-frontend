type ComposerInput = {
  isFocused: () => boolean;
  blur: () => void;
};

type ClearComposerAfterSubmitInput = {
  input: ComposerInput | null;
  dismissKeyboard: () => void;
  clearDraft: () => void;
  deferClearUntilBlur: (clear: () => void) => void;
};

export const clearComposerAfterSubmit = ({
  input,
  dismissKeyboard,
  clearDraft,
  deferClearUntilBlur,
}: ClearComposerAfterSubmitInput) => {
  if (!input?.isFocused()) {
    clearDraft();
    return;
  }

  deferClearUntilBlur(clearDraft);
  input.blur();
  dismissKeyboard();
};
