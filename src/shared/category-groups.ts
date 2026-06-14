import type { EntityType, GroupName } from './message-types';

export const GROUP_NAMES: readonly GroupName[] = [
  'Identity',
  'Contact',
  'Financial',
  'Network',
  'Location',
  'Password',
  'Organization',
  'Documents',
  'Temporal',
  'Sensitive',
  'Low-signal',
];

export const GROUP_MEMBERS: Readonly<Record<GroupName, readonly EntityType[]>> = {
  Identity: ['PERSON', 'USERNAME', 'PERSON_NAME', 'PERSON_ALIAS', 'PERSON_ATTRIBUTE', 'PERSON_ROLE', 'NATIONALITY'],
  Contact: ['EMAIL', 'PHONE', 'ADDRESS', 'CONTACT_HANDLE'],
  Financial: ['CREDIT_CARD', 'IBAN', 'BANK_ACCOUNT', 'SSN', 'FINANCIAL_AMOUNT', 'PAYMENT_CARD_SECURITY', 'TAX_ID'],
  Network: ['IP_ADDRESS', 'MAC_ADDRESS', 'DEVICE_IDENTIFIER'],
  Location: ['LOCATION', 'GEO_LOCATION'],
  Password: ['PASSWORD'],
  Organization: ['ORGANIZATION'],
  Documents: ['DOCUMENT_IDENTIFIER', 'DOCUMENT_REFERENCE', 'PASSPORT', 'DRIVER_LICENSE', 'NATIONAL_ID'],
  Temporal: ['DATE', 'DATE_OF_BIRTH'],
  Sensitive: ['SENSITIVE'],
  'Low-signal': ['URL', 'MISC'],
};

export const GROUP_DEFAULT_ON: Readonly<Record<GroupName, boolean>> = {
  Identity: true,
  Contact: true,
  Financial: true,
  Network: true,
  Location: true,
  Password: true,
  Organization: true,
  Documents: true,
  Temporal: true,
  Sensitive: true,
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
