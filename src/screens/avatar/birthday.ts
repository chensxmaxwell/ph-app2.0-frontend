const removeDigitBeforeDeletedSeparator = (
  value: string,
  previousValue: string
): string => {
  if (previousValue.length !== value.length + 1) {
    return value;
  }

  const separatorIndex = previousValue
    .split("")
    .findIndex((character, index) => {
      return (
        character === "/" &&
        `${previousValue.slice(0, index)}${previousValue.slice(index + 1)}` ===
          value
      );
    });

  if (separatorIndex <= 0) {
    return value;
  }

  return `${value.slice(0, separatorIndex - 1)}${value.slice(separatorIndex)}`;
};

export const formatBirthdayInput = (
  value: string,
  previousValue = ""
): string => {
  const editableValue = removeDigitBeforeDeletedSeparator(value, previousValue);
  const digits = editableValue.replace(/\D/g, "").slice(0, 8);
  const month = digits.slice(0, 2);
  const day = digits.slice(2, 4);
  const year = digits.slice(4);

  return [month, day, year].filter(Boolean).join("/");
};
