// The only cities a user can pick at sign-up (and the ones the seed uses). Shown as the listing
// location on cards and detail, so a free-text city would make the feed inconsistent.
export const USER_ZONES = [
  'Roma Norte, CDMX',
  'Condesa, CDMX',
  'Palermo, Buenos Aires',
  'Providencia, Santiago',
  'Chapinero, Bogotá',
  'Miraflores, Lima',
  'Pinheiros, São Paulo',
] as const;

export type UserZone = (typeof USER_ZONES)[number];
