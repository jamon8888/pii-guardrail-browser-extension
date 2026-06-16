import type { EntityType } from '../../src/shared/message-types';
import {
  GROUP_NAMES,
  GROUP_MEMBERS,
  GROUP_DEFAULT_ON,
  groupForEntity,
  entitiesForGroup,
  defaultGroupsEnabled,
  filterByGroup,
} from '../../src/shared/category-groups';
import type { PiiSpan } from '../../src/shared/message-types';

function makeSpan(entityType: EntityType, text = 'x'): PiiSpan {
  return { start: 0, end: text.length, entity_type: entityType, score: 0.9, text, source: 'regex' };
}

// --- EntityType → group lookup ---

const ENTITY_TO_EXPECTED_GROUP: [EntityType, string][] = [
  ['PERSON', 'Personal'],
  ['PERSON_NAME', 'Personal'],
  ['PERSON_ALIAS', 'Personal'],
  ['USERNAME', 'Personal'],
  ['EMAIL', 'Contact'],
  ['PHONE', 'Contact'],
  ['ADDRESS', 'Contact'],
  ['CONTACT_HANDLE', 'Contact'],
  ['CREDIT_CARD', 'Financial'],
  ['PAYMENT_CARD_SECURITY', 'Financial'],
  ['IBAN', 'Financial'],
  ['BANK_ACCOUNT', 'Financial'],
  ['SSN', 'Financial'],
  ['FINANCIAL_AMOUNT', 'Financial'],
  ['IP_ADDRESS', 'Network'],
  ['MAC_ADDRESS', 'Network'],
  ['LOCATION', 'Location'],
  ['GEO_LOCATION', 'Location'],
  ['PASSWORD', 'Password'],
  ['ORGANIZATION', 'Organization'],
  ['PASSPORT', 'Documents'],
  ['DRIVER_LICENSE', 'Documents'],
  ['TAX_ID', 'Documents'],
  ['NATIONAL_ID', 'Documents'],
  ['DOCUMENT_IDENTIFIER', 'Documents'],
  ['DOCUMENT_REFERENCE', 'Documents'],
  ['VEHICLE_IDENTIFIER', 'Documents'],
  ['DATE', 'Temporal'],
  ['DATE_OF_BIRTH', 'Temporal'],
  ['HEALTH_DATA', 'Health'],
  ['BIOMETRIC_DATA', 'Biometric'],
  ['GENETIC_DATA', 'Biometric'],
  ['RELIGION_OR_BELIEF', 'Beliefs'],
  ['POLITICAL_OPINION', 'Beliefs'],
  ['TRADE_UNION_MEMBERSHIP', 'Beliefs'],
  ['ETHNIC_ORIGIN', 'Identity'],
  ['SEXUAL_ORIENTATION', 'Identity'],
  ['CRIMINAL_OFFENCE_DATA', 'Criminal'],
  ['URL', 'Low-signal'],
  ['MISC', 'Low-signal'],
  ['PERSON_ATTRIBUTE', 'Low-signal'],
  ['PERSON_ROLE', 'Low-signal'],
  ['NATIONALITY', 'Low-signal'],
  ['DEVICE_IDENTIFIER', 'Low-signal'],
];

describe('groupForEntity', () => {
  test.each(ENTITY_TO_EXPECTED_GROUP)(
    '%s → %s',
    (entityType, expectedGroup) => {
      expect(groupForEntity(entityType)).toBe(expectedGroup);
    }
  );

  test('MISC → Low-signal', () => {
    expect(groupForEntity('MISC')).toBe('Low-signal');
  });
});

// --- Group → entity types + default state ---

describe('entitiesForGroup', () => {
  test('Personal contains PERSON, PERSON_NAME, PERSON_ALIAS, and USERNAME', () => {
    expect(entitiesForGroup('Personal')).toEqual(expect.arrayContaining(['PERSON', 'PERSON_NAME', 'PERSON_ALIAS', 'USERNAME']));
    expect(entitiesForGroup('Personal')).toHaveLength(4);
  });

  test('Contact contains EMAIL, PHONE, ADDRESS, CONTACT_HANDLE', () => {
    const members = entitiesForGroup('Contact');
    expect(members).toEqual(expect.arrayContaining(['EMAIL', 'PHONE', 'ADDRESS', 'CONTACT_HANDLE']));
    expect(members).toHaveLength(4);
  });

  test('Financial contains CREDIT_CARD, PAYMENT_CARD_SECURITY, IBAN, BANK_ACCOUNT, SSN, FINANCIAL_AMOUNT', () => {
    const members = entitiesForGroup('Financial');
    expect(members).toEqual(expect.arrayContaining(['CREDIT_CARD', 'PAYMENT_CARD_SECURITY', 'IBAN', 'BANK_ACCOUNT', 'SSN', 'FINANCIAL_AMOUNT']));
    expect(members).toHaveLength(6);
  });

  test('Network contains IP_ADDRESS and MAC_ADDRESS', () => {
    expect(entitiesForGroup('Network')).toEqual(expect.arrayContaining(['IP_ADDRESS', 'MAC_ADDRESS']));
    expect(entitiesForGroup('Network')).toHaveLength(2);
  });

  test('Location contains LOCATION and GEO_LOCATION', () => {
    expect(entitiesForGroup('Location')).toEqual(expect.arrayContaining(['LOCATION', 'GEO_LOCATION']));
    expect(entitiesForGroup('Location')).toHaveLength(2);
  });

  test('Password contains PASSWORD only', () => {
    expect(entitiesForGroup('Password')).toEqual(['PASSWORD']);
  });

  test('Organization contains ORGANIZATION only', () => {
    expect(entitiesForGroup('Organization')).toEqual(['ORGANIZATION']);
  });

  test('Health contains HEALTH_DATA', () => {
    expect(entitiesForGroup('Health')).toEqual(['HEALTH_DATA']);
  });

  test('Biometric contains BIOMETRIC_DATA and GENETIC_DATA', () => {
    expect(entitiesForGroup('Biometric')).toEqual(expect.arrayContaining(['BIOMETRIC_DATA', 'GENETIC_DATA']));
    expect(entitiesForGroup('Biometric')).toHaveLength(2);
  });

  test('Beliefs contains RELIGION_OR_BELIEF, POLITICAL_OPINION, TRADE_UNION_MEMBERSHIP', () => {
    expect(entitiesForGroup('Beliefs')).toEqual(expect.arrayContaining(['RELIGION_OR_BELIEF', 'POLITICAL_OPINION', 'TRADE_UNION_MEMBERSHIP']));
    expect(entitiesForGroup('Beliefs')).toHaveLength(3);
  });

  test('Identity contains ETHNIC_ORIGIN and SEXUAL_ORIENTATION', () => {
    expect(entitiesForGroup('Identity')).toEqual(expect.arrayContaining(['ETHNIC_ORIGIN', 'SEXUAL_ORIENTATION']));
    expect(entitiesForGroup('Identity')).toHaveLength(2);
  });

  test('Criminal contains CRIMINAL_OFFENCE_DATA', () => {
    expect(entitiesForGroup('Criminal')).toEqual(['CRIMINAL_OFFENCE_DATA']);
  });

  test('Low-signal contains URL, MISC, PERSON_ATTRIBUTE, PERSON_ROLE, NATIONALITY, DEVICE_IDENTIFIER', () => {
    const members = entitiesForGroup('Low-signal');
    expect(members).toEqual(expect.arrayContaining(['URL', 'MISC', 'PERSON_ATTRIBUTE', 'PERSON_ROLE', 'NATIONALITY', 'DEVICE_IDENTIFIER']));
    expect(members).toHaveLength(6);
  });
});

// --- Default on/off state ---

describe('GROUP_DEFAULT_ON', () => {
  test('all groups except Low-signal are on by default', () => {
    for (const group of GROUP_NAMES) {
      if (group === 'Low-signal') {
        expect(GROUP_DEFAULT_ON[group]).toBe(false);
      } else {
        expect(GROUP_DEFAULT_ON[group]).toBe(true);
      }
    }
  });

  test('defaultGroupsEnabled() returns a copy of defaults', () => {
    const a = defaultGroupsEnabled();
    const b = defaultGroupsEnabled();
    expect(a).toEqual(b);
    a['Identity'] = false;
    expect(b['Identity']).toBe(true); // copy, not shared reference
  });
});

// --- GROUP_NAMES completeness ---

describe('GROUP_NAMES', () => {
  test('has exactly 15 groups', () => {
    expect(GROUP_NAMES).toHaveLength(15);
  });

  test('every group appears in GROUP_MEMBERS', () => {
    for (const group of GROUP_NAMES) {
      expect(GROUP_MEMBERS[group]).toBeDefined();
    }
  });
});

// --- filterByGroup ---

describe('filterByGroup', () => {
  test('passes all spans when all groups are enabled', () => {
    const spans = [makeSpan('PERSON'), makeSpan('EMAIL'), makeSpan('URL')];
    const groupsEnabled = defaultGroupsEnabled();
    groupsEnabled['Low-signal'] = true;
    expect(filterByGroup(spans, groupsEnabled)).toHaveLength(3);
  });

  test('drops spans whose group is disabled', () => {
    const spans = [makeSpan('PERSON'), makeSpan('IP_ADDRESS'), makeSpan('EMAIL')];
    const groupsEnabled = defaultGroupsEnabled();
    groupsEnabled['Network'] = false;
    const result = filterByGroup(spans, groupsEnabled);
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.entity_type)).toEqual(['PERSON', 'EMAIL']);
  });

  test('Low-signal off by default drops URL and MISC', () => {
    const spans = [makeSpan('PERSON'), makeSpan('URL'), makeSpan('DATE'), makeSpan('EMAIL')];
    const groupsEnabled = defaultGroupsEnabled(); // Low-signal is false
    const result = filterByGroup(spans, groupsEnabled);
    expect(result.map((s) => s.entity_type)).toEqual(['PERSON', 'DATE', 'EMAIL']);
  });

  test('MISC is filtered when Low-signal is disabled', () => {
    const spans = [makeSpan('MISC')];
    const groupsEnabled = defaultGroupsEnabled(); // Low-signal is false by default
    expect(filterByGroup(spans, groupsEnabled)).toHaveLength(0);
  });

  test('empty spans input returns empty array', () => {
    expect(filterByGroup([], defaultGroupsEnabled())).toEqual([]);
  });

  test('multiple groups disabled filters all their members', () => {
    const spans = [
      makeSpan('PERSON'),
      makeSpan('EMAIL'),
      makeSpan('CREDIT_CARD'),
      makeSpan('IP_ADDRESS'),
      makeSpan('PASSWORD'),
    ];
    const groupsEnabled = defaultGroupsEnabled();
    groupsEnabled['Contact'] = false;
    groupsEnabled['Financial'] = false;
    const result = filterByGroup(spans, groupsEnabled);
    expect(result.map((s) => s.entity_type)).toEqual(['PERSON', 'IP_ADDRESS', 'PASSWORD']);
  });
});
