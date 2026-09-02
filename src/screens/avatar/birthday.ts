export const formatBirthdayInput = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  const month = digits.slice(0, 2);
  const day = digits.slice(2, 4);
  const year = digits.slice(4);

  return [month, day, year].filter(Boolean).join("/");
};
