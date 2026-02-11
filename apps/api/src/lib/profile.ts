import zipcodes from "zipcodes";

export function normalizeZipCode(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{5})(?:-\d{4})?$/);

  if (!match) {
    throw new Error("zipCode must be a valid US ZIP code (12345 or 12345-6789).");
  }

  return match[1];
}

export function stateFromZipCode(zipCode: string): string | null {
  const record = zipcodes.lookup(zipCode);
  return record?.state ?? null;
}
