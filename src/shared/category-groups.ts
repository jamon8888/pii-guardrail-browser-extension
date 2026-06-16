import type { EntityType, GroupName } from './message-types';

export const GROUP_NAMES: readonly GroupName[] = [
  'Personal',
  'Contact',
  'Financial',
  'Network',
  'Location',
  'Password',
  'Organization',
  'Documents',
  'Temporal',
  'Health',
  'Biometric',
  'Beliefs',
  'Identity',
  'Criminal',
  'Low-signal',
] as const;

export const GROUP_MEMBERS: Readonly<Record<GroupName, readonly EntityType[]>> = {
  Personal: ['PERSON', 'PERSON_NAME', 'PERSON_ALIAS', 'USERNAME'],
  Contact: ['EMAIL', 'PHONE', 'ADDRESS', 'CONTACT_HANDLE'],
  Financial: ['CREDIT_CARD', 'PAYMENT_CARD_SECURITY', 'IBAN', 'BANK_ACCOUNT', 'SSN', 'FINANCIAL_AMOUNT'],
  Network: ['IP_ADDRESS', 'MAC_ADDRESS'],
  Location: ['LOCATION', 'GEO_LOCATION'],
  Password: ['PASSWORD'],
  Organization: ['ORGANIZATION'],
  Documents: ['PASSPORT', 'DRIVER_LICENSE', 'TAX_ID', 'NATIONAL_ID', 'DOCUMENT_IDENTIFIER', 'DOCUMENT_REFERENCE', 'VEHICLE_IDENTIFIER'],
  Temporal: ['DATE', 'DATE_OF_BIRTH'],
  Health: ['HEALTH_DATA'],
  Biometric: ['BIOMETRIC_DATA', 'GENETIC_DATA'],
  Beliefs: ['RELIGION_OR_BELIEF', 'POLITICAL_OPINION', 'TRADE_UNION_MEMBERSHIP'],
  Identity: ['ETHNIC_ORIGIN', 'SEXUAL_ORIENTATION'],
  Criminal: ['CRIMINAL_OFFENCE_DATA'],
  'Low-signal': ['URL', 'MISC', 'PERSON_ATTRIBUTE', 'PERSON_ROLE', 'NATIONALITY', 'DEVICE_IDENTIFIER'],
};

export const GROUP_DEFAULT_ON: Readonly<Record<GroupName, boolean>> = {
  Personal: true,
  Contact: true,
  Financial: true,
  Network: true,
  Location: true,
  Password: true,
  Organization: true,
  Documents: true,
  Temporal: true,
  Health: true,
  Biometric: true,
  Beliefs: true,
  Identity: true,
  Criminal: true,
  'Low-signal': false,
};

const ENTITY_TO_GROUP: Partial<Record<EntityType, GroupName>> = {};
for (const [group, types] of Object.entries(GROUP_MEMBERS) as [GroupName, EntityType[]][]) {
  for (const type of types) {
    ENTITY_TO_GROUP[type] = group;
  }
}

export function groupForEntity(entityType: EntityType): GroupName | null {
  return ENTITY_TO_GROUP[entityType] ?? null;
}

export function entitiesForGroup(group: GroupName): readonly EntityType[] {
  return GROUP_MEMBERS[group];
}

export function defaultGroupsEnabled(): Record<GroupName, boolean> {
  return { ...GROUP_DEFAULT_ON };
}

/** Filter spans to only those whose group is enabled. */
export function filterByGroup(
  spans: import('./message-types').PiiSpan[],
  groupsEnabled: Record<GroupName, boolean>,
): import('./message-types').PiiSpan[] {
  return spans.filter((span) => {
    const group = groupForEntity(span.entity_type);
    return group !== null && groupsEnabled[group] !== false;
  });
}
