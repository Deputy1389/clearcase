declare module "zipcodes" {
  export interface ZipCodeRecord {
    zip: string;
    city: string;
    state: string;
    latitude: number;
    longitude: number;
  }

  export function lookup(zip: string | number): ZipCodeRecord | undefined;
}
