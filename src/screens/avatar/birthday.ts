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

export const BIRTHDAY_PLACEHOLDER = "mm/dd/yyyy";
export const BIRTHDAY_HINT = "Use mm/dd/yyyy";

// The one birthday rule for every create / edit entry: empty is fine, anything
// typed must be a real calendar date written mm/dd/yyyy.
export const isPlausibleBirthday = (value: string): boolean => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return true;
  }
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (!match) {
    return false;
  }
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
};
