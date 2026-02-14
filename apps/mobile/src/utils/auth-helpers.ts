export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidUsZip(value: string): boolean {
  return /^\d{5}(?:-\d{4})?$/.test(value.trim());
}

export function isStrongPassword(value: string): boolean {
  return value.trim().length >= 8;
}
