import { describe, expect, it, jest } from "@jest/globals";
import { clearComposerAfterSubmit } from "../src/services/composer-submit";

describe("clearComposerAfterSubmit", () => {
  it("waits for native blur before clearing a focused composer", () => {
    const order: string[] = [];
    let deferredClear: (() => void) | undefined;

    clearComposerAfterSubmit({
      input: {
        isFocused: () => {
          order.push("isFocused");
          return true;
        },
        blur: () => order.push("blur"),
      },
      dismissKeyboard: () => order.push("dismissKeyboard"),
      clearDraft: () => order.push("clearDraft"),
      deferClearUntilBlur: (clear) => {
        order.push("deferClear");
        deferredClear = clear;
      },
    });

    expect(order).toEqual([
      "isFocused",
      "deferClear",
      "blur",
      "dismissKeyboard",
    ]);

    deferredClear?.();
    expect(order).toEqual([
      "isFocused",
      "deferClear",
      "blur",
      "dismissKeyboard",
      "clearDraft",
    ]);
  });

  it("clears immediately when the composer is no longer first responder", () => {
    const clearDraft = jest.fn();
    const deferClearUntilBlur = jest.fn();
    const dismissKeyboard = jest.fn();
    const blur = jest.fn();

    clearComposerAfterSubmit({
      input: { isFocused: () => false, blur },
      dismissKeyboard,
      clearDraft,
      deferClearUntilBlur,
    });

    expect(clearDraft).toHaveBeenCalledTimes(1);
    expect(deferClearUntilBlur).not.toHaveBeenCalled();
    expect(blur).not.toHaveBeenCalled();
    expect(dismissKeyboard).not.toHaveBeenCalled();
  });
});
