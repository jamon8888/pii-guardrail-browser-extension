# GDPR Art.9 Granular Detection — Design Spec

**Date**: 2026-06-15
**Status**: Approved
**Scope**: UI granularity + regex fallback for GDPR Art.9 sensitive data categories

---

## Problem

The current implementation collapses all 9 GDPR Art.9 sensitive data categories into a single `SENSITIVE` super-type. This creates three problems:

1. **No UI granularity** — Users see "Sensitive" but cannot distinguish health data from religious beliefs
2. **No regex fallback** — All SENSITIVE detections depend exclusively on the bardsai-v2 NER model. If NER is disabled/unavailable, zero sensitive data is detected
3. **Incomplete coverage** — One category ("sex life") has no label in any detection model

## Goals

- Expose 5 GDPR sub-groups in the UI (Health, Biometric, Beliefs, Identity, Criminal)
- Add regex fallback patterns for all 9 GDPR Art.9 categories (FR + EN + universal)
- Add light regex for remaining NER-only types (PERSON_ATTRIBUTE, PERSON_ROLE, NATIONALITY, GEO_LOCATION, FINANCIAL_AMOUNT, DOCUMENT_IDENTIFIER, DOCUMENT_REFERENCE, VEHICLE_IDENTIFIER, DEVICE_IDENTIFIER)
- Show granular sub-type in the detection overlay (badge coloré)
- Maintain backward compatibility with existing group toggles

---

## Architecture

### New GDPR Sub-Groups

Replace the monolithic `Sensitive` group with 5 sub-groups:

| Group | Entity Types | Regex Engine |
|-------|-------------|--------------|
| **Health** | HEALTH_DATA | FR/EN medical keywords + NPI pattern |
| **Biometric** | BIOMETRIC_DATA, GENETIC_DATA | FR/EN biometric/genetic keywords |
| **Beliefs** | RELIGION_OR_BELIEF, POLITICAL_OPINION, TRADE_UNION_MEMBERSHIP | FR/EN religious/political/union keywords |
| **Identity** | ETHNIC_ORIGIN, SEXUAL_ORIENTATION | FR/EN identity keywords |
| **Criminal** | CRIMINAL_OFFENCE_DATA | FR/EN criminal justice keywords |

The `Sensitive` group name is removed from `GROUP_NAMES`. The 5 new groups replace it.

### Detection Pipeline Changes

```
Text
├── cloakrs regex (22 types, checksum-validated)
├── Hand-written regex (7 types: email, phone, SSN, CC, IP, IBAN, date)
├── GDPR regex (5 sub-groups, FR/EN/universal)          ← NEW
├── NER-only regex (9 light patterns)                    ← NEW
├── merge_regex_results() → cloakrs prioritaire
├── BardsAI v2 NER (44 types including GDPR Art.9 sub-types)
├── Context word scoring
├── Merger (dedup overlaps)
├── Threshold filtering
└── PiiSpan[] → WASM → UI
```

GDPR regex patterns are added alongside hand-written regex. They follow the same merge rules: regex results fill gaps where NER doesn't detect.

### Data Model Changes

#### PiiSpan (Rust + TypeScript)

No structural changes needed. The `entity_type` field now carries the granular GDPR type directly (e.g., `HEALTH_DATA` instead of `SENSITIVE`). The `raw_label` field is **removed** from PiiSpan — it is no longer needed since entity_type carries the sub-type.

#### EntityType Union (TypeScript) — EXPANDED

Add 9 new GDPR Art.9 sub-types to the EntityType union. The `SENSITIVE` super-type is **removed** — replaced by the individual types:

```typescript
// NEW types (8)
'HEALTH_DATA' | 'BIOMETRIC_DATA' | 'GENETIC_DATA' |
'RELIGION_OR_BELIEF' | 'POLITICAL_OPINION' | 'TRADE_UNION_MEMBERSHIP' |
'ETHNIC_ORIGIN' | 'SEXUAL_ORIENTATION' | 'CRIMINAL_OFFENCE_DATA'

// REMOVED: 'SENSITIVE' (replaced by the 9 individual types above)
```

**Final EntityType count: 44** (36 existing − 1 SENSITIVE + 9 GDPR sub-types).

The `raw_label` field is **no longer needed** on PiiSpan — the entity_type itself carries the sub-type. The `raw_label` field can be repurposed or removed.

**Rust enum update** (`crate/src/types.rs`): Add 8 new variants, remove `Sensitive`.

#### Category Groups (TypeScript)

```typescript
// BEFORE
GROUP_MEMBERS.Sensitive = ['SENSITIVE'];

// AFTER — SENSITIVE is gone, replaced by 5 groups with individual types
GROUP_MEMBERS.Health = ['HEALTH_DATA'];
GROUP_MEMBERS.Biometric = ['BIOMETRIC_DATA', 'GENETIC_DATA'];
GROUP_MEMBERS.Beliefs = ['RELIGION_OR_BELIEF', 'POLITICAL_OPINION', 'TRADE_UNION_MEMBERSHIP'];
GROUP_MEMBERS.Identity = ['ETHNIC_ORIGIN', 'SEXUAL_ORIENTATION'];
GROUP_MEMBERS.Criminal = ['CRIMINAL_OFFENCE_DATA'];
```

`GroupName` union changes from 11 to 15 values (remove `Sensitive`, add `Health`, `Biometric`, `Beliefs`, `Identity`, `Criminal`). Rename existing `Identity` group to `Personal` to avoid collision.

**"Sex life" handling**: No label exists in any model. The category is acknowledged in the UI description ("Sex life") but has no detection engine. It is documented as a known limitation.

#### NER Provider (TypeScript)

Update `BARDSAI_V2_LABEL_MAP` in `src/offscreen/ner-provider.ts` to map GDPR labels to the new individual types instead of SENSITIVE:

```typescript
// BEFORE (all mapped to SENSITIVE)
HEALTH_DATA: 'SENSITIVE',
BIOMETRIC_DATA: 'SENSITIVE',
GENETIC_DATA: 'SENSITIVE',
ETHNIC_ORIGIN: 'SENSITIVE',
POLITICAL_OPINION: 'SENSITIVE',
RELIGION_OR_BELIEF: 'SENSITIVE',
SEXUAL_ORIENTATION: 'SENSITIVE',
TRADE_UNION_MEMBERSHIP: 'SENSITIVE',
CRIMINAL_OFFENCE_DATA: 'SENSITIVE',

// AFTER (each maps to its own EntityType)
HEALTH_DATA: 'HEALTH_DATA',
BIOMETRIC_DATA: 'BIOMETRIC_DATA',
GENETIC_DATA: 'GENETIC_DATA',
ETHNIC_ORIGIN: 'ETHNIC_ORIGIN',
POLITICAL_OPINION: 'POLITICAL_OPINION',
RELIGION_OR_BELIEF: 'RELIGION_OR_BELIEF',
SEXUAL_ORIENTATION: 'SEXUAL_ORIENTATION',
TRADE_UNION_MEMBERSHIP: 'TRADE_UNION_MEMBERSHIP',
CRIMINAL_OFFENCE_DATA: 'CRIMINAL_OFFENCE_DATA',
```

#### Rust EntityType Enum

Update `crate/src/types.rs` to add 8 new variants and remove `Sensitive`:

```rust
// REMOVE
Sensitive,

// ADD
HealthData,
BiometricData,
GeneticData,
ReligionOrBelief,
PoliticalOpinion,
TradeUnionMembership,
EthnicOrigin,
SexualOrientation,
CriminalOffenceData,
```

Update `ALL_ENTITY_TYPES` constant accordingly.

#### Sensitivity Resolver (TypeScript)

Each new GDPR type gets its own threshold in `CATEGORY_THRESHOLDS`:

```typescript
HEALTH_DATA: 0.65,
BIOMETRIC_DATA: 0.65,
GENETIC_DATA: 0.65,
RELIGION_OR_BELIEF: 0.65,
POLITICAL_OPINION: 0.65,
TRADE_UNION_MEMBERSHIP: 0.65,
ETHNIC_ORIGIN: 0.65,
SEXUAL_ORIENTATION: 0.65,
CRIMINAL_OFFENCE_DATA: 0.65,
```

Remove the old `SENSITIVE: 0.65` entry.

---

## UI Changes

### Popup (Group Toggles)

The 11 group chips/toggles become 15. The "Sensitive" toggle is replaced by 5 sub-toggles:

```
Before: Identity | Contact | Financial | Network | Location | Password | Org | Docs | Temporal | Sensitive | Low-signal
After:  Identity | Contact | Financial | Network | Location | Password | Org | Docs | Temporal | Health | Biometric | Beliefs | Identity* | Criminal | Low-signal
```

*Note: rename the existing "Identity" group to "Personal" to avoid collision with the new GDPR "Identity" group.

**Group naming**:

| Old Name | New Name | Types |
|----------|----------|-------|
| Identity | **Personal** | PERSON_NAME, PERSON_ALIAS, USERNAME |
| (new) | **Health** | HEALTH_DATA |
| (new) | **Biometric** | BIOMETRIC_DATA, GENETIC_DATA |
| (new) | **Beliefs** | RELIGION_OR_BELIEF, POLITICAL_OPINION, TRADE_UNION_MEMBERSHIP |
| (new) | **Identity** | ETHNIC_ORIGIN, SEXUAL_ORIENTATION |
| (new) | **Criminal** | CRIMINAL_OFFENCE_DATA |

### Detection Overlay (Badge Coloré)

Each GDPR Art.9 entity displays its specific type with a color-coded badge:

```
[HEALTH_DATA] "je souffre de diabète"           ← red badge
[BELIEFS] "membre du parti socialiste"          ← blue badge
[IDENTITY] "origine africaine"                   ← orange badge
```

**Color mapping** (CSS variables):

| EntityType | Color | CSS variable |
|------------|-------|-------------|
| HEALTH_DATA | Red | `--pg-type-health: #ef5350` |
| BIOMETRIC_DATA, GENETIC_DATA | Purple | `--pg-type-biometric: #ab47bc` |
| RELIGION_OR_BELIEF, POLITICAL_OPINION, TRADE_UNION_MEMBERSHIP | Blue | `--pg-type-beliefs: #42a5f5` |
| ETHNIC_ORIGIN, SEXUAL_ORIENTATION | Orange | `--pg-type-identity: #ff9800` |
| CRIMINAL_OFFENCE_DATA | Grey | `--pg-type-criminal: #78909c` |

**Tooltip**: Shows entity_type + confidence score.

### EntityRow.svelte Changes

```svelte
<span class="pg-pill pg-pill-{entity.type.toLowerCase()}">
  {entity.type}
</span>
```

CSS classes handle color per type. No conditional logic needed — each type has its own pill color.

---

## Regex Patterns

### File: `crate/src/gdpr_regex.rs`

New module with 5 recognizer functions:

```rust
pub fn detect_health(text: &str) -> Vec<PiiSpan>
pub fn detect_biometric(text: &str) -> Vec<PiiSpan>
pub fn detect_beliefs(text: &str) -> Vec<PiiSpan>
pub fn detect_identity(text: &str) -> Vec<PiiSpan>
pub fn detect_criminal(text: &str) -> Vec<PiiSpan>
pub fn detect_gdpr(text: &str) -> Vec<PiiSpan>  // orchestrator
```

### Health Patterns

**FR**:
- `diagnostic`, `ordonnance`, `traitement`, `patient`, `dossier médical`, `assurance maladie`, `mutuelle`, `hospitalisation`, `chirurgie`, `cancer`, `diabète`, `hypertension`
- Pattern: `N° patient \d{6,12}`

**EN**:
- `diagnosis`, `prescription`, `treatment`, `patient`, `medical record`, `health insurance`, `hospitalization`, `surgery`, `cancer`, `diabetes`, `hypertension`
- Pattern: `NPI \d{10}` (National Provider Identifier)

**Universal**:
- Pattern: `\d{2}-\d{7}` (NPI-like), `dossier\s+med[ie]cal\s+\d+`

**Score**: 0.85 (keyword alone), 0.95 (keyword + pattern)

### Biometric Patterns

**FR**:
- `empreinte digitale`, `iris`, `reconnaissance faciale`, `scanner rétinien`, `ADN`, `génotype`, `séquençage génomique`, `profil génétique`

**EN**:
- `fingerprint`, `facial recognition`, `iris scan`, `retinal scan`, `DNA`, `genotype`, `genome sequencing`, `genetic profile`

**Universal**:
- Pattern: `ADN/[A-Z0-9]{6}`, `DNA/[A-Z0-9]{6}`

**Score**: 0.80 (keyword), 0.90 (keyword + pattern)

### Beliefs Patterns

**FR**:
- `religion`, `croyance`, `église`, `mosquée`, `synagogue`, `temple`, `parti politique`, `syndicat`, `adhérent`, `membre`, `CGT`, `CFDT`, `FO`, `UDI`, `LR`, `PS`, `LREM`, `RN`

**EN**:
- `religion`, `church`, `mosque`, `synagogue`, `temple`, `political party`, `trade union`, `membership`, `democrat`, `republican`, `labour`, `conservative`

**Universal**:
- Pattern: `N°\s*adh[ée]rent\s+\d+`, `membership\s*(number|no|#)\s*\d+`

**Score**: 0.75 (keyword), 0.90 (keyword + pattern)

### Identity Patterns

**FR**:
- `origine ethnique`, `race`, `orientation sexuelle`, `genre`, `identité de genre`, `ethnie`

**EN**:
- `ethnic origin`, `race`, `sexual orientation`, `gender identity`, `ethnicity`

**Universal**: (few structural patterns — depends on textual context)

**Score**: 0.70 (keyword only)

### Criminal Patterns

**FR**:
- `casier judiciaire`, `condamnation`, `peine`, `tribunal`, `infraction`, `conviction`, `procès`, `arrestation`, `garde à vue`

**EN**:
- `criminal record`, `conviction`, `sentence`, `court`, `offence`, `felony`, `misdemeanor`, `arrest`, `detention`

**Universal**:
- Pattern: `B2/\d{7}` (format casier judiciaire FR)

**Score**: 0.85 (keyword), 0.95 (keyword + pattern)

**Context proximity**: GDPR regex patterns require a context keyword within 50 characters of the match to reduce false positives. For example, "diagnostic" alone is insufficient — it must appear near other medical context.

### Light Regex for Other NER-Only Types

File: `crate/src/ner_fallback_regex.rs`

| Type | Pattern | Score |
|------|---------|-------|
| PERSON_ATTRIBUTE | `né(e?) le`, `âge\s*:\s*\d+`, `taille\s*:\s*\d+`, `poids\s*:\s*\d+` | 0.70 |
| PERSON_ROLE | `directeur`, `professeur`, `médecin`, `avocat`, `CEO`, `CTO`, `manager` | 0.70 |
| NATIONALITY | `nationalité\s*:`, `citoyen(ne?)`, `passeport\s+[A-Z]{2}` | 0.70 |
| GEO_LOCATION | `GPS\s*[-+]?\d+\.\d+\s*,\s*[-+]?\d+\.\d+`, `latitude`, `longitude` | 0.75 |
| FINANCIAL_AMOUNT | `\d[\d\s]*[\.,]\d{2}\s*€`, `\d[\d\s]*[\.,]\d{2}\s*USD`, `montant\s*:` | 0.70 |
| DOCUMENT_IDENTIFIER | `réf\.\s*:`, `numéro\s*:`, `N°\s*[A-Z0-9]{4,}` | 0.70 |
| DOCUMENT_REFERENCE | `ref\.`, `annexe\s+\d+`, `pièce\s+jointe` | 0.70 |
| VEHICLE_IDENTIFIER | `immatriculation`, `VIN\s*:\s*[A-HJ-NPR-Z0-9]{17}` | 0.75 |
| DEVICE_IDENTIFIER | `serial`, `S/N\s*:\s*\w+`, `MAC\s*:\s*[0-9A-F]{2}(:[0-9A-F]{2}){5}`, `UUID` | 0.75 |

---

## Fallback Behavior

### When NER is unavailable

- GDPR sub-groups are detected exclusively by regex
- Score thresholds apply: Health (0.85), Biometric (0.80), Beliefs (0.75), Identity (0.70), Criminal (0.85)
- Other NER-only types use light regex at 0.70 threshold

### When NER is available

- NER + regex merge (same as cloakrs + regex currently)
- Regex fills gaps where NER doesn't detect
- NER `raw_label` is preserved for UI display

### Pipeline integration

```rust
// In pipeline.rs detect()
let regex_spans = merge_regex_results(text);           // existing
let gdpr_spans = gdpr_regex::detect_gdpr(text);       // NEW
let ner_fallback = ner_fallback_regex::detect(text);   // NEW
let all_regex = [regex_spans, gdpr_spans, ner_fallback].concat();
let merged_regex = merge_regex_results_from(all_regex);
```

---

## i18n

New message keys in `_locales/en/messages.json` and `_locales/fr/messages.json`:

```json
{
  "groupHealth": { "message": "Health", "description": "GDPR Art.9 health data group" },
  "groupHealth_desc": { "message": "Medical records, diagnoses, prescriptions", "description": "..." },
  "groupBiometric": { "message": "Biometric", "description": "GDPR Art.9 biometric/genetic group" },
  "groupBiometric_desc": { "message": "Fingerprints, DNA, facial recognition", "description": "..." },
  "groupBeliefs": { "message": "Beliefs", "description": "GDPR Art.9 beliefs group" },
  "groupBeliefs_desc": { "message": "Religion, political opinions, trade union", "description": "..." },
  "groupIdentity": { "message": "Identity", "description": "GDPR Art.9 identity group" },
  "groupIdentity_desc": { "message": "Ethnic origin, sexual orientation", "description": "..." },
  "groupCriminal": { "message": "Criminal", "description": "GDPR Art.10 criminal data group" },
  "groupCriminal_desc": { "message": "Criminal records, convictions", "description": "..." }
}
```

Rename existing "Identity" group to "Personal":

```json
{
  "groupPersonal": { "message": "Personal", "description": "Names, aliases, usernames" },
  "groupPersonal_desc": { "message": "Person names, aliases, and usernames", "description": "..." }
}
```

---

## Testing Plan

### Unit Tests (Rust)

| Category | Count | Description |
|----------|-------|-------------|
| `gdpr_regex::tests` | 30 | 5 sub-groups × FR/EN × 2-3 patterns each |
| `ner_fallback_regex::tests` | 15 | 9 types × 1-2 patterns each |
| `pipeline::tests::gdpr_*` | 10 | Integration: NER unavailable (regex-only mode) |
| `pipeline::tests::gdpr_ner_*` | 10 | Integration: NER available (fusion mode) |

### Unit Tests (TypeScript)

| Category | Count | Description |
|----------|-------|-------------|
| `category-groups.test.ts` | 5 | New group names, member lists |
| `message-types.test.ts` | 1 | GroupName union updated (15 values) |
| `sensitivity-resolver.test.ts` | 5 | New thresholds for GDPR types |

### UI Tests (TypeScript)

| Category | Count | Description |
|----------|-------|-------------|
| `EntityRow.test.ts` | 5 | Individual GDPR type pill rendering with correct CSS class |
| `overlay-model.test.ts` | 5 | Color mapping per GDPR type |
| `popup-model.test.ts` | 5 | 15 group toggles rendered |

### E2E Scenarios

| Scenario | Description |
|----------|-------------|
| FR health text | Paste French medical text → Health group toggled → HEALTH_DATA detected |
| EN belief text | Paste English political text → Beliefs group toggled → POLITICAL_OPINION detected |
| NER disabled | Disable NER → paste text → regex fallback detects GDPR categories |

**Total**: ~91 new tests

---

## Files to Create/Modify

### Create
- `crate/src/gdpr_regex.rs` — GDPR Art.9 regex patterns
- `crate/src/ner_fallback_regex.rs` — Light regex for NER-only types
- `tests/integration/gdpr-detection.test.ts` — Integration tests

### Modify
- `crate/src/lib.rs` — Add `mod gdpr_regex; mod ner_fallback_regex;`
- `crate/src/pipeline.rs` — Integrate GDPR regex + NER fallback
- `crate/src/types.rs` — Expand EntityType enum (add 8 GDPR types, remove SENSITIVE)
- `src/shared/category-groups.ts` — Replace SENSITIVE with 5 sub-groups, rename Identity→Personal
- `src/shared/message-types.ts` — Update EntityType (44 values) + GroupName union (15 values)
- `src/shared/sensitivity-resolver.ts` — Add thresholds for 9 GDPR types, remove SENSITIVE
- `src/shared/storage.ts` — Update normalizeSettings for 15 groups
- `src/ui/overlay/components/EntityRow.svelte` — Per-type pill colors for GDPR types
- `src/ui/overlay/overlay-model.ts` — Color mapping for GDPR types
- `src/popup/popup-model.svelte.ts` — Update CATEGORY_LABELS/DESCRIPTIONS for 15 groups
- `src/offscreen/ner-provider.ts` — Map GDPR labels to individual types (not SENSITIVE)
- `_locales/en/messages.json` — Add 10 new i18n keys
- `_locales/fr/messages.json` — Add 10 new i18n keys
- `scripts/check-privacy-boundary.js` — Update allowed findings if needed
- All existing test files referencing `Sensitive` group or `SENSITIVE` type

---

## Risks

| Risk | Mitigation |
|------|-----------|
| 15 toggles clutter the UI | Group chips on 3 rows; keep descriptions short |
| Regex false positives (e.g., "diagnostic" in non-medical context) | Require context keywords within 50 chars |
| Breaking existing tests | Update all `Sensitive`/`SENSITIVE` references; run full suite |
| EntityType expansion (36→44) affects Rust enum, TS union, label maps, tests | Systematic update across all layers; run `cargo test` + `npx jest` |
| "Sex life" category uncovered | Documented as known limitation; no model label exists |
| Migration for existing users | Auto-migrate: if `groupsEnabled.Sensitive === false`, set all 5 new GDPR groups to `false` in `normalizeSettings()` |

---

## Migration Strategy

When existing users upgrade, their settings may reference the old `Sensitive` group. The migration is handled in `normalizeSettings()` (`src/shared/storage.ts`):

```typescript
// Auto-migrate SENSITIVE toggle to 5 new groups
if (settings.groupsEnabled.Sensitive !== undefined) {
  const sensitiveEnabled = settings.groupsEnabled.Sensitive;
  settings.groupsEnabled.Health = sensitiveEnabled;
  settings.groupsEnabled.Biometric = sensitiveEnabled;
  settings.groupsEnabled.Beliefs = sensitiveEnabled;
  settings.groupsEnabled.Identity = sensitiveEnabled;
  settings.groupsEnabled.Criminal = sensitiveEnabled;
  delete settings.groupsEnabled.Sensitive;
}
```

If `Sensitive` was OFF, all 5 new groups default to OFF. If ON, they default to ON (matching the `GROUP_DEFAULT_ON` values). This preserves user intent.
