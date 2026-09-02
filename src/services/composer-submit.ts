type ComposerInput = {
  isFocused: () => boolean;
  blur: () => void;
};

type ClearComposerAfterSubmitInput = {
  endEditingBeforeClear: boolean;
  input: ComposerInput | null;
  dismissKeyboard: () => void;
  clearDraft: () => void;
  deferClearUntilBlur: (clear: () => void) => void;
};

export const clearComposerAfterSubmit = ({
  endEditingBeforeClear,
  input,
  dismissKeyboard,
  clearDraft,
  deferClearUntilBlur,
}: ClearComposerAfterSubmitInput) => {
  if (!endEditingBeforeClear || !input?.isFocused()) {
    clearDraft();
    return;
  }

  deferClearUntilBlur(clearDraft);
  input.blur();
  dismissKeyboard();
};
