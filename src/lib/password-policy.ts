export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_RULE_MESSAGE = "Пароль: от 8 до 128 символов, хотя бы одна буква и одна цифра.";

export function isValidNewPassword(password: string) {
  return password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH && /\p{L}/u.test(password) && /[0-9]/.test(password);
}
