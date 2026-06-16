# GDPR Art.9 Granular Detection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the monolithic SENSITIVE type with 9 individual GDPR Art.9 entity types, add regex fallback patterns, and expose 5 sub-groups in the UI.

**Architecture:** Expand EntityType from 36→44 (remove SENSITIVE, add 9 GDPR types). Add two new Rust regex modules (gdpr_regex + ner_fallback_regex). Update TypeScript type system, category groups, sensitivity resolver, storage migration, NER label maps, UI pill colors, and i18n keys.

**Tech Stack:** Rust (WASM), TypeScript, Svelte, onnxruntime-web, jest, cargo test

**Spec:** `docs/superpowers/specs/2026-06-15-gdpr-granular-detection-design.md`

---

### Task 1: Rust EntityType Expansion

**Files:**
- Modify: `crate/src/types.rs` (lines 6-43, 211-248)

- [ ] **Step 1: Expand EntityType enum**

In `crate/src/types.rs`, remove `Sensitive` variant (line 42) and add 9 new variants before the closing brace:

```rust
// REMOVE line 42:
//     Sensitive,

// ADD these 9 variants (after VehicleIdentifier):
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

- [ ] **Step 2: Update ALL_ENTITY_TYPES constant**

In the `#[cfg(test)] mod tests` block, update `ALL_ENTITY_TYPES` (lines 211-248). Remove `"Sensitive"` and add the 9 new type strings:

```rust
    pub const ALL_ENTITY_TYPES: &[&str] = &[
        "Person", "Email", "Phone", "CreditCard", "Ssn", "Iban",
        "IpAddress", "Location", "Organization", "Address", "Url",
        "Username", "Password", "BankAccount", "Date", "Misc",
        "PersonName", "PersonAlias", "PersonAttribute", "PersonRole",
        "DateOfBirth", "DocumentIdentifier", "DocumentReference",
        "Passport", "DriverLicense", "TaxId", "NationalId",
        "Nationality", "GeoLocation", "FinancialAmount",
        "PaymentCardSecurity", "MacAddress", "DeviceIdentifier",
        "VehicleIdentifier", "ContactHandle",
        // NEW GDPR Art.9 types
        "HealthData", "BiometricData", "GeneticData",
        "ReligionOrBelief", "PoliticalOpinion", "TradeUnionMembership",
        "EthnicOrigin", "SexualOrientation", "CriminalOffenceData",
    ];
```

- [ ] **Step 3: Run Rust tests**

Run: `cd crate && cargo test --lib`
Expected: PASS (existing tests still work, new types don't break anything)

- [ ] **Step 4: Commit**

```bash
git add crate/src/types.rs
git commit -m "feat(rust): expand EntityType enum with 9 GDPR Art.9 sub-types, remove SENSITIVE"
```

---

### Task 2: Rust GDPR Regex Module

**Files:**
- Create: `crate/src/gdpr_regex.rs`

- [ ] **Step 1: Create gdpr_regex.rs with all 5 recognizer functions**

```rust
use crate::types::{EntityType, DetectionSource, PiiSpan};

fn make_span(text: &str, start: usize, end: usize, entity_type: EntityType, score: f64) -> PiiSpan {
    PiiSpan {
        start,
        end,
        text: text[start..end].to_string(),
        entity_type,
        score,
        source: DetectionSource::Regex,
    }
}

/// Check if a keyword appears within `window` chars of position `pos` in `text`.
fn has_context(text: &str, pos: usize, window: usize, keywords: &[&str]) -> bool {
    let start = pos.saturating_sub(window);
    let end = (pos + window).min(text.len());
    let slice = &text[start..end];
    let lower = slice.to_lowercase();
    keywords.iter().any(|k| lower.contains(k))
}

pub fn detect_health(text: &str) -> Vec<PiiSpan> {
    let mut results = Vec::new();
    let lower = text.to_lowercase();

    // FR keywords
    let fr_kw = ["diagnostic", "ordonnance", "traitement", "patient",
                  "dossier médical", "assurance maladie", "mutuelle",
                  "hospitalisation", "chirurgie", "cancer", "diabète",
                  "hypertension", "ordonnance"];
    // EN keywords
    let en_kw = ["diagnosis", "prescription", "treatment", "patient",
                  "medical record", "health insurance", "hospitalization",
                  "surgery", "cancer", "diabetes", "hypertension"];

    for kw in fr_kw.iter().chain(en_kw.iter()) {
        let mut search_start = 0;
        while let Some(pos) = lower[search_start..].find(kw) {
            let abs_pos = search_start + pos;
            let end = abs_pos + kw.len();
            if has_context(text, abs_pos, 50, &["médical", "medical", "santé", "health", "patient", "diagnostic", "diagnosis"]) {
                results.push(make_span(text, abs_pos, end, EntityType::HealthData, 0.85));
            }
            search_start = end;
        }
    }

    // Universal pattern: NPI-like 10 digits
    let re_npi = regex::Regex::new(r"\b\d{2}-\d{7}\b").unwrap();
    for m in re_npi.find_iter(text) {
        if has_context(text, m.start(), 50, &["patient", "npi", "medical", "health"]) {
            results.push(make_span(text, m.start(), m.end(), EntityType::HealthData, 0.90));
        }
    }

    results
}

pub fn detect_biometric(text: &str) -> Vec<PiiSpan> {
    let mut results = Vec::new();
    let lower = text.to_lowercase();

    let fr_kw = ["empreinte digitale", "iris", "reconnaissance faciale",
                  "scanner rétinien", "adn", "génotype", "séquençage génomique",
                  "profil génétique"];
    let en_kw = ["fingerprint", "facial recognition", "iris scan",
                  "retinal scan", "dna", "genotype", "genome sequencing",
                  "genetic profile"];

    for kw in fr_kw.iter().chain(en_kw.iter()) {
        let mut search_start = 0;
        while let Some(pos) = lower[search_start..].find(kw) {
            let abs_pos = search_start + pos;
            let end = abs_pos + kw.len();
            results.push(make_span(text, abs_pos, end, EntityType::BiometricData, 0.80));
            search_start = end;
        }
    }

    // DNA/ADN patterns
    let re_dna = regex::Regex::new(r"(?i)(?:ADN|DNA)/[A-Z0-9]{6}").unwrap();
    for m in re_dna.find_iter(text) {
        results.push(make_span(text, m.start(), m.end(), EntityType::GeneticData, 0.90));
    }

    results
}

pub fn detect_beliefs(text: &str) -> Vec<PiiSpan> {
    let mut results = Vec::new();
    let lower = text.to_lowercase();

    let fr_kw = ["religion", "croyance", "église", "mosquée", "synagogue",
                  "temple", "parti politique", "syndicat", "adhérent",
                  "membre", "cgt", "cfdt", "fo", "udi", "lr", "ps", "lrem", "rn"];
    let en_kw = ["religion", "church", "mosque", "synagogue", "temple",
                  "political party", "trade union", "membership",
                  "democrat", "republican", "labour", "conservative"];

    for kw in fr_kw.iter().chain(en_kw.iter()) {
        let mut search_start = 0;
        while let Some(pos) = lower[search_start..].find(kw) {
            let abs_pos = search_start + pos;
            let end = abs_pos + kw.len();
            // Determine sub-type based on keyword
            let entity_type = if ["religion", "croyance", "église", "mosquée",
                                   "synagogue", "temple", "church", "mosque"].contains(&kw) {
                EntityType::ReligionOrBelief
            } else if ["parti politique", "political party", "democrat",
                        "republican", "labour", "conservative"].contains(&kw) {
                EntityType::PoliticalOpinion
            } else {
                EntityType::TradeUnionMembership
            };
            results.push(make_span(text, abs_pos, end, entity_type, 0.75));
            search_start = end;
        }
    }

    // Universal pattern: membership number
    let re_mem = regex::Regex::new(r"(?i)(?:N°\s*adhérent|membership\s*(?:number|no|#))\s*\d+").unwrap();
    for m in re_mem.find_iter(text) {
        results.push(make_span(text, m.start(), m.end(), EntityType::TradeUnionMembership, 0.90));
    }

    results
}

pub fn detect_identity(text: &str) -> Vec<PiiSpan> {
    let mut results = Vec::new();
    let lower = text.to_lowercase();

    let fr_kw = ["origine ethnique", "race", "orientation sexuelle",
                  "genre", "identité de genre", "ethnie"];
    let en_kw = ["ethnic origin", "race", "sexual orientation",
                  "gender identity", "ethnicity"];

    for kw in fr_kw.iter().chain(en_kw.iter()) {
        let mut search_start = 0;
        while let Some(pos) = lower[search_start..].find(kw) {
            let abs_pos = search_start + pos;
            let end = abs_pos + kw.len();
            let entity_type = if ["orientation sexuelle", "sexual orientation",
                                   "genre", "identité de genre", "gender identity"].contains(&kw) {
                EntityType::SexualOrientation
            } else {
                EntityType::EthnicOrigin
            };
            results.push(make_span(text, abs_pos, end, entity_type, 0.70));
            search_start = end;
        }
    }

    results
}

pub fn detect_criminal(text: &str) -> Vec<PiiSpan> {
    let mut results = Vec::new();
    let lower = text.to_lowercase();

    let fr_kw = ["casier judiciaire", "condamnation", "peine", "tribunal",
                  "infraction", "conviction", "procès", "arrestation",
                  "garde à vue"];
    let en_kw = ["criminal record", "conviction", "sentence", "court",
                  "offence", "felony", "misdemeanor", "arrest", "detention"];

    for kw in fr_kw.iter().chain(en_kw.iter()) {
        let mut search_start = 0;
        while let Some(pos) = lower[search_start..].find(kw) {
            let abs_pos = search_start + pos;
            let end = abs_pos + kw.len();
            if has_context(text, abs_pos, 50, &["judiciaire", "criminal", "tribunal", "court", "condamnation", "conviction"]) {
                results.push(make_span(text, abs_pos, end, EntityType::CriminalOffenceData, 0.85));
            }
            search_start = end;
        }
    }

    // Universal pattern: B2/XXXXXXXX (casier judiciaire format)
    let re_b2 = regex::Regex::new(r"B2/\d{7}").unwrap();
    for m in re_b2.find_iter(text) {
        results.push(make_span(text, m.start(), m.end(), EntityType::CriminalOffenceData, 0.95));
    }

    results
}

/// Run all GDPR Art.9 regex recognizers
pub fn detect_gdpr(text: &str) -> Vec<PiiSpan> {
    let mut results = Vec::new();
    results.extend(detect_health(text));
    results.extend(detect_biometric(text));
    results.extend(detect_beliefs(text));
    results.extend(detect_identity(text));
    results.extend(detect_criminal(text));
    results
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_health_fr_diagnostic() {
        let spans = detect_health("Le diagnostic de cancer a été confirmé");
        assert!(!spans.is_empty());
        assert!(spans.iter().any(|s| s.entity_type == EntityType::HealthData));
    }

    #[test]
    fn test_health_en_diagnosis() {
        let spans = detect_health("The diagnosis of diabetes was confirmed");
        assert!(!spans.is_empty());
        assert!(spans.iter().any(|s| s.entity_type == EntityType::HealthData));
    }

    #[test]
    fn test_health_no_context_no_match() {
        let spans = detect_health("Le diagnostic du problème technique");
        // "diagnostic" alone without medical context should not match
        assert!(spans.is_empty());
    }

    #[test]
    fn test_biometric_fingerprint() {
        let spans = detect_biometric("L'empreinte digitale a été capturée");
        assert!(!spans.is_empty());
        assert!(spans.iter().any(|s| s.entity_type == EntityType::BiometricData));
    }

    #[test]
    fn test_biometric_dna_pattern() {
        let spans = detect_biometric("ADN/ABC123 séquencé");
        assert!(!spans.is_empty());
        assert!(spans.iter().any(|s| s.entity_type == EntityType::GeneticData));
    }

    #[test]
    fn test_beliefs_religion() {
        let spans = detect_beliefs("Sa religion est mentionnée");
        assert!(!spans.is_empty());
        assert!(spans.iter().any(|s| s.entity_type == EntityType::ReligionOrBelief));
    }

    #[test]
    fn test_beliefs_political() {
        let spans = detect_beliefs("Appartenance au parti politique LR");
        assert!(!spans.is_empty());
        assert!(spans.iter().any(|s| s.entity_type == EntityType::PoliticalOpinion));
    }

    #[test]
    fn test_beliefs_union() {
        let spans = detect_beliefs("Membre du syndicat CGT");
        assert!(!spans.is_empty());
        assert!(spans.iter().any(|s| s.entity_type == EntityType::TradeUnionMembership));
    }

    #[test]
    fn test_beliefs_membership_number() {
        let spans = detect_beliefs("N° adhérent 12345");
        assert!(!spans.is_empty());
        assert!(spans.iter().any(|s| s.entity_type == EntityType::TradeUnionMembership));
    }

    #[test]
    fn test_identity_ethnic() {
        let spans = detect_identity("L'origine ethnique est indiquée");
        assert!(!spans.is_empty());
        assert!(spans.iter().any(|s| s.entity_type == EntityType::EthnicOrigin));
    }

    #[test]
    fn test_identity_sexual() {
        let spans = detect_identity("Orientation sexuelle mentionnée");
        assert!(!spans.is_empty());
        assert!(spans.iter().any(|s| s.entity_type == EntityType::SexualOrientation));
    }

    #[test]
    fn test_criminal_record() {
        let spans = detect_criminal("Casier judiciaire vierge");
        assert!(!spans.is_empty());
        assert!(spans.iter().any(|s| s.entity_type == EntityType::CriminalOffenceData));
    }

    #[test]
    fn test_criminal_b2_pattern() {
        let spans = detect_criminal("Référence B2/1234567");
        assert!(!spans.is_empty());
        assert!(spans.iter().any(|s| s.entity_type == EntityType::CriminalOffenceData));
    }

    #[test]
    fn test_criminal_en_conviction() {
        let spans = detect_criminal("Criminal record check required");
        assert!(!spans.is_empty());
        assert!(spans.iter().any(|s| s.entity_type == EntityType::CriminalOffenceData));
    }

    #[test]
    fn test_detect_gdpr_combined() {
        let text = "Patient avec diagnostic de cancer, religion catholique, casier judiciaire";
        let spans = detect_gdpr(text);
        assert!(spans.iter().any(|s| s.entity_type == EntityType::HealthData));
        assert!(spans.iter().any(|s| s.entity_type == EntityType::ReligionOrBelief));
        assert!(spans.iter().any(|s| s.entity_type == EntityType::CriminalOffenceData));
    }

    #[test]
    fn test_no_false_positives() {
        let spans = detect_gdpr("Bonjour, comment allez-vous aujourd'hui?");
        assert!(spans.is_empty());
    }
}
```

- [ ] **Step 2: Run GDPR regex tests**

Run: `cd crate && cargo test gdpr_regex`
Expected: 17 tests PASS

- [ ] **Step 3: Commit**

```bash
git add crate/src/gdpr_regex.rs
git commit -m "feat(rust): add GDPR Art.9 regex recognizer module (5 sub-groups, FR/EN/universal)"
```

---

### Task 3: Rust NER Fallback Regex Module

**Files:**
- Create: `crate/src/ner_fallback_regex.rs`

- [ ] **Step 1: Create ner_fallback_regex.rs**

```rust
use crate::types::{EntityType, DetectionSource, PiiSpan};

fn make_span(text: &str, start: usize, end: usize, entity_type: EntityType, score: f64) -> PiiSpan {
    PiiSpan {
        start,
        end,
        text: text[start..end].to_string(),
        entity_type,
        score,
        source: DetectionSource::Regex,
    }
}

pub fn detect_ner_fallback(text: &str) -> Vec<PiiSpan> {
    let mut results = Vec::new();
    let lower = text.to_lowercase();

    // PERSON_ATTRIBUTE
    let re_attr = regex::Regex::new(r"(?i)(?:né\(e?\)\s+le|âge\s*:\s*\d+|taille\s*:\s*\d+|poids\s*:\s*\d+)").unwrap();
    for m in re_attr.find_iter(text) {
        results.push(make_span(text, m.start(), m.end(), EntityType::PersonAttribute, 0.70));
    }

    // PERSON_ROLE
    let role_kw = ["directeur", "directrice", "professeur", "professeure",
                    "médecin", "avocat", "avocate", "ceo", "cto", "manager",
                    "director", "professor", "doctor", "lawyer"];
    for kw in &role_kw {
        let mut search_start = 0;
        while let Some(pos) = lower[search_start..].find(kw) {
            let abs_pos = search_start + pos;
            let end = abs_pos + kw.len();
            results.push(make_span(text, abs_pos, end, EntityType::PersonRole, 0.70));
            search_start = end;
        }
    }

    // NATIONALITY
    let re_nat = regex::Regex::new(r"(?i)(?:nationalité\s*:|citoyen\(ne?\)|passeport\s+[A-Z]{2})").unwrap();
    for m in re_nat.find_iter(text) {
        results.push(make_span(text, m.start(), m.end(), EntityType::Nationality, 0.70));
    }

    // GEO_LOCATION
    let re_geo = regex::Regex::new(r"(?i)GPS\s*[-+]?\d+\.d+\s*,\s*[-+]?\d+\.d+").unwrap();
    for m in re_geo.find_iter(text) {
        results.push(make_span(text, m.start(), m.end(), EntityType::GeoLocation, 0.75));
    }

    // FINANCIAL_AMOUNT
    let re_fin = regex::Regex::new(r"\d[\d\s]*[.,]\d{2}\s*(?:€|USD|EUR)").unwrap();
    for m in re_fin.find_iter(text) {
        results.push(make_span(text, m.start(), m.end(), EntityType::FinancialAmount, 0.70));
    }

    // DOCUMENT_IDENTIFIER
    let re_doc = regex::Regex::new(r"(?i)(?:réf\.|numéro|N°)\s*:? ?[A-Z0-9]{4,}").unwrap();
    for m in re_doc.find_iter(text) {
        results.push(make_span(text, m.start(), m.end(), EntityType::DocumentIdentifier, 0.70));
    }

    // DOCUMENT_REFERENCE
    let re_ref = regex::Regex::new(r"(?i)(?:annexe\s+\d+|pièce\s+jointe)").unwrap();
    for m in re_ref.find_iter(text) {
        results.push(make_span(text, m.start(), m.end(), EntityType::DocumentReference, 0.70));
    }

    // VEHICLE_IDENTIFIER
    let re_vin = regex::Regex::new(r"(?i)VIN\s*:\s*[A-HJ-NPR-Z0-9]{17}").unwrap();
    for m in re_vin.find_iter(text) {
        results.push(make_span(text, m.start(), m.end(), EntityType::VehicleIdentifier, 0.75));
    }

    // DEVICE_IDENTIFIER
    let re_dev = regex::Regex::new(r"(?i)(?:serial|S/N\s*:\s*\w+|MAC\s*:\s*[0-9A-F]{2}(?::[0-9A-F]{2}){5}|UUID)").unwrap();
    for m in re_dev.find_iter(text) {
        results.push(make_span(text, m.start(), m.end(), EntityType::DeviceIdentifier, 0.75));
    }

    results
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_person_attribute_age() {
        let spans = detect_ner_fallback("Âge : 42");
        assert!(spans.iter().any(|s| s.entity_type == EntityType::PersonAttribute));
    }

    #[test]
    fn test_person_role_doctor() {
        let spans = detect_ner_fallback("Le médecin a confirmé");
        assert!(spans.iter().any(|s| s.entity_type == EntityType::PersonRole));
    }

    #[test]
    fn test_nationality() {
        let spans = detect_ner_fallback("Nationalité : française");
        assert!(spans.iter().any(|s| s.entity_type == EntityType::Nationality));
    }

    #[test]
    fn test_geo_location_gps() {
        let spans = detect_ner_fallback("GPS 48.8566, 2.3522");
        assert!(spans.iter().any(|s| s.entity_type == EntityType::GeoLocation));
    }

    #[test]
    fn test_financial_amount() {
        let spans = detect_ner_fallback("Montant : 1500,00 €");
        assert!(spans.iter().any(|s| s.entity_type == EntityType::FinancialAmount));
    }

    #[test]
    fn test_document_identifier() {
        let spans = detect_ner_fallback("Réf : ABCD-1234");
        assert!(spans.iter().any(|s| s.entity_type == EntityType::DocumentIdentifier));
    }

    #[test]
    fn test_vehicle_vin() {
        let spans = detect_ner_fallback("VIN: 1HGBH41JXMN109186");
        assert!(spans.iter().any(|s| s.entity_type == EntityType::VehicleIdentifier));
    }

    #[test]
    fn test_device_serial() {
        let spans = detect_ner_fallback("S/N: ABC123XYZ");
        assert!(spans.iter().any(|s| s.entity_type == EntityType::DeviceIdentifier));
    }

    #[test]
    fn test_no_match() {
        let spans = detect_ner_fallback("Bonjour world");
        assert!(spans.is_empty());
    }
}
```

- [ ] **Step 2: Run NER fallback tests**

Run: `cd crate && cargo test ner_fallback_regex`
Expected: 9 tests PASS

- [ ] **Step 3: Commit**

```bash
git add crate/src/ner_fallback_regex.rs
git commit -m "feat(rust): add NER fallback regex module (9 types: PERSON_ATTRIBUTE, PERSON_ROLE, etc.)"
```

---

### Task 4: Rust Pipeline Integration

**Files:**
- Modify: `crate/src/lib.rs` (lines 1-9)
- Modify: `crate/src/pipeline.rs` (lines 36-54, 135-171)

- [ ] **Step 1: Add mod declarations to lib.rs**

In `crate/src/lib.rs`, add after line 7 (`mod regex_recognizers;`):

```rust
mod gdpr_regex;
mod ner_fallback_regex;
```

- [ ] **Step 2: Integrate GDPR + NER fallback into pipeline**

In `crate/src/pipeline.rs`, find the regex merge section (around line 39). Add GDPR and NER fallback regex calls:

```rust
// BEFORE (line ~39):
let mut regex_spans = merge_regex_results(cloakrs_spans, hand_written_spans);

// AFTER:
let gdpr_spans = gdpr_regex::detect_gdpr(text);
let ner_fallback_spans = ner_fallback_regex::detect_ner_fallback(text);
let mut regex_spans = merge_regex_results(cloakrs_spans, hand_written_spans);
regex_spans.extend(gdpr_spans);
regex_spans.extend(ner_fallback_spans);
```

- [ ] **Step 3: Add NER threshold entries for new types**

In `crate/src/pipeline.rs`, find `ner_min_confidence` (lines 135-171). Add entries for the 9 new types:

```rust
EntityType::HealthData => 0.65,
EntityType::BiometricData => 0.65,
EntityType::GeneticData => 0.65,
EntityType::ReligionOrBelief => 0.65,
EntityType::PoliticalOpinion => 0.65,
EntityType::TradeUnionMembership => 0.65,
EntityType::EthnicOrigin => 0.65,
EntityType::SexualOrientation => 0.65,
EntityType::CriminalOffenceData => 0.65,
```

- [ ] **Step 4: Run Rust tests**

Run: `cd crate && cargo test --lib`
Expected: All tests PASS (existing + new GDPR/NER fallback tests)

- [ ] **Step 5: Commit**

```bash
git add crate/src/lib.rs crate/src/pipeline.rs
git commit -m "feat(rust): integrate GDPR regex + NER fallback into detection pipeline"
```

---

### Task 5: TypeScript EntityType Expansion

**Files:**
- Modify: `src/shared/message-types.ts` (lines 15-53, 55-65)

- [ ] **Step 1: Expand EntityType union**

In `src/shared/message-types.ts`, remove `'SENSITIVE'` from the EntityType union (line 53) and add the 9 new types:

```typescript
// REMOVE line 53:
//   | 'SENSITIVE'

// ADD after 'VEHICLE_IDENTIFIER':
  | 'HEALTH_DATA'
  | 'BIOMETRIC_DATA'
  | 'GENETIC_DATA'
  | 'RELIGION_OR_BELIEF'
  | 'POLITICAL_OPINION'
  | 'TRADE_UNION_MEMBERSHIP'
  | 'ETHNIC_ORIGIN'
  | 'SEXUAL_ORIENTATION'
  | 'CRIMINAL_OFFENCE_DATA'
```

- [ ] **Step 2: Update ENTITY_TYPES const array**

In `src/shared/message-types.ts`, update the `ENTITY_TYPES` const array (lines 55-65). Remove `'SENSITIVE'` and add the 9 new types:

```typescript
export const ENTITY_TYPES: readonly EntityType[] = [
  // ... existing 35 types ...
  // REMOVE: 'SENSITIVE',
  // ADD:
  'HEALTH_DATA',
  'BIOMETRIC_DATA',
  'GENETIC_DATA',
  'RELIGION_OR_BELIEF',
  'POLITICAL_OPINION',
  'TRADE_UNION_MEMBERSHIP',
  'ETHNIC_ORIGIN',
  'SEXUAL_ORIENTATION',
  'CRIMINAL_OFFENCE_DATA',
] as const;
```

- [ ] **Step 3: Run TS type check**

Run: `npx tsc --noEmit`
Expected: No type errors (or only pre-existing ones)

- [ ] **Step 4: Commit**

```bash
git add src/shared/message-types.ts
git commit -m "feat(ts): expand EntityType union with 9 GDPR Art.9 sub-types, remove SENSITIVE"
```

---

### Task 6: TypeScript Category Groups

**Files:**
- Modify: `src/shared/category-groups.ts` (lines 3-15, 17-31, 33-45)

- [ ] **Step 1: Update GROUP_NAMES**

In `src/shared/category-groups.ts`, replace the GROUP_NAMES array (lines 3-15):

```typescript
export const GROUP_NAMES: readonly GroupName[] = [
  'Personal',      // renamed from 'Identity'
  'Contact',
  'Financial',
  'Network',
  'Location',
  'Password',
  'Organization',
  'Documents',
  'Temporal',
  'Health',         // NEW
  'Biometric',      // NEW
  'Beliefs',        // NEW
  'Identity',       // NEW (GDPR identity)
  'Criminal',       // NEW
  'Low-signal',
] as const;
```

- [ ] **Step 2: Update GROUP_MEMBERS**

Replace the GROUP_MEMBERS object (lines 17-31):

```typescript
export const GROUP_MEMBERS: Record<GroupName, readonly EntityType[]> = {
  Personal: ['PERSON_NAME', 'PERSON_ALIAS', 'USERNAME'],
  Contact: ['EMAIL', 'PHONE', 'ADDRESS', 'CONTACT_HANDLE'],
  Financial: ['CREDIT_CARD', 'PAYMENT_CARD_SECURITY', 'IBAN', 'BANK_ACCOUNT', 'SSN', 'FINANCIAL_AMOUNT'],
  Network: ['IP_ADDRESS', 'MAC_ADDRESS'],
  Location: ['LOCATION', 'GEO_LOCATION'],
  Password: ['PASSWORD'],
  Organization: ['ORGANIZATION'],
  Documents: ['PASSPORT', 'DRIVER_LICENSE', 'TAX_ID', 'NATIONAL_ID', 'DOCUMENT_IDENTIFIER', 'DOCUMENT_REFERENCE', 'VEHICLE_IDENTIFIER'],
  Temporal: ['DATE', 'DATE_OF_BIRTH'],
  Health: ['HEALTH_DATA'],                    // NEW
  Biometric: ['BIOMETRIC_DATA', 'GENETIC_DATA'],  // NEW
  Beliefs: ['RELIGION_OR_BELIEF', 'POLITICAL_OPINION', 'TRADE_UNION_MEMBERSHIP'],  // NEW
  Identity: ['ETHNIC_ORIGIN', 'SEXUAL_ORIENTATION'],  // NEW
  Criminal: ['CRIMINAL_OFFENCE_DATA'],        // NEW
  'Low-signal': ['URL', 'MISC', 'PERSON_ATTRIBUTE', 'PERSON_ROLE', 'NATIONALITY', 'DEVICE_IDENTIFIER'],
};
```

- [ ] **Step 3: Update GROUP_DEFAULT_ON**

Replace the GROUP_DEFAULT_ON object (lines 33-45):

```typescript
export const GROUP_DEFAULT_ON: Record<GroupName, boolean> = {
  Personal: true,
  Contact: true,
  Financial: true,
  Network: true,
  Location: true,
  Password: true,
  Organization: true,
  Documents: true,
  Temporal: true,
  Health: true,         // NEW
  Biometric: true,      // NEW
  Beliefs: true,        // NEW
  Identity: true,       // NEW
  Criminal: true,       // NEW
  'Low-signal': false,
};
```

- [ ] **Step 4: Run TS type check**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add src/shared/category-groups.ts
git commit -m "feat(ts): replace SENSITIVE group with 5 GDPR sub-groups (Health, Biometric, Beliefs, Identity, Criminal)"
```

---

### Task 7: TypeScript Sensitivity Resolver

**Files:**
- Modify: `src/shared/sensitivity-resolver.ts` (lines 13-50)

- [ ] **Step 1: Update CATEGORY_THRESHOLDS**

In `src/shared/sensitivity-resolver.ts`, remove `SENSITIVE: 0.65` and add the 9 new types:

```typescript
// REMOVE:
//   SENSITIVE: 0.65,

// ADD:
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

- [ ] **Step 2: Run TS type check**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/shared/sensitivity-resolver.ts
git commit -m "feat(ts): update sensitivity thresholds for 9 GDPR Art.9 types"
```

---

### Task 8: TypeScript Storage Migration

**Files:**
- Modify: `src/shared/storage.ts` (lines 88-143)

- [ ] **Step 1: Add SENSITIVE migration in normalizeSettings**

In `src/shared/storage.ts`, inside `normalizeSettings()`, add migration logic after the existing group normalization:

```typescript
// Auto-migrate old SENSITIVE toggle to 5 new GDPR groups
if ((settings.groupsEnabled as Record<string, boolean>).Sensitive !== undefined) {
  const sensitiveEnabled = (settings.groupsEnabled as Record<string, boolean>).Sensitive;
  settings.groupsEnabled.Health = sensitiveEnabled;
  settings.groupsEnabled.Biometric = sensitiveEnabled;
  settings.groupsEnabled.Beliefs = sensitiveEnabled;
  settings.groupsEnabled.Identity = sensitiveEnabled;
  settings.groupsEnabled.Criminal = sensitiveEnabled;
  delete (settings.groupsEnabled as Record<string, boolean>).Sensitive;
}
```

- [ ] **Step 2: Run TS type check**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/shared/storage.ts
git commit -m "feat(ts): auto-migrate SENSITIVE toggle to 5 new GDPR groups in normalizeSettings"
```

---

### Task 9: TypeScript NER Provider Label Maps

**Files:**
- Modify: `src/offscreen/ner-provider.ts` (lines 438-486)

- [ ] **Step 1: Update BARDSAI_V2_LABEL_MAP**

In `src/offscreen/ner-provider.ts`, update the GDPR label mappings (lines 476-485):

```typescript
// BEFORE:
HEALTH_DATA: 'SENSITIVE',
BIOMETRIC_DATA: 'SENSITIVE',
GENETIC_DATA: 'SENSITIVE',
ETHNIC_ORIGIN: 'SENSITIVE',
POLITICAL_OPINION: 'SENSITIVE',
RELIGION_OR_BELIEF: 'SENSITIVE',
SEXUAL_ORIENTATION: 'SENSITIVE',
TRADE_UNION_MEMBERSHIP: 'SENSITIVE',
CRIMINAL_OFFENCE_DATA: 'SENSITIVE',

// AFTER:
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

- [ ] **Step 2: Run TS type check**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/offscreen/ner-provider.ts
git commit -m "feat(ts): map GDPR NER labels to individual EntityType values (not SENSITIVE)"
```

---

### Task 10: UI EntityRow Pill Colors

**Files:**
- Modify: `src/ui/overlay/components/EntityRow.svelte` (line 53)
- Create/Modify: CSS file for pill colors

- [ ] **Step 1: Add CSS classes for new GDPR types**

Add CSS rules for the 9 new types (in the overlay CSS or a shared styles file):

```css
.pg-pill-health_data { background: #ef5350; color: white; }
.pg-pill-biometric_data { background: #ab47bc; color: white; }
.pg-pill-genetic_data { background: #ab47bc; color: white; }
.pg-pill-religion_or_belief { background: #42a5f5; color: white; }
.pg-pill-political_opinion { background: #42a5f5; color: white; }
.pg-pill-trade_union_membership { background: #42a5f5; color: white; }
.pg-pill-ethnic_origin { background: #ff9800; color: white; }
.pg-pill-sexual_orientation { background: #ff9800; color: white; }
.pg-pill-criminal_offence_data { background: #78909c; color: white; }

.pg-highlight-health_data { background: rgba(239, 83, 80, 0.2); border-bottom: 2px solid #ef5350; }
.pg-highlight-biometric_data { background: rgba(171, 71, 188, 0.2); border-bottom: 2px solid #ab47bc; }
.pg-highlight-genetic_data { background: rgba(171, 71, 188, 0.2); border-bottom: 2px solid #ab47bc; }
.pg-highlight-religion_or_belief { background: rgba(66, 165, 245, 0.2); border-bottom: 2px solid #42a5f5; }
.pg-highlight-political_opinion { background: rgba(66, 165, 245, 0.2); border-bottom: 2px solid #42a5f5; }
.pg-highlight-trade_union_membership { background: rgba(66, 165, 245, 0.2); border-bottom: 2px solid #42a5f5; }
.pg-highlight-ethnic_origin { background: rgba(255, 152, 0, 0.2); border-bottom: 2px solid #ff9800; }
.pg-highlight-sexual_orientation { background: rgba(255, 152, 0, 0.2); border-bottom: 2px solid #ff9800; }
.pg-highlight-criminal_offence_data { background: rgba(120, 144, 156, 0.2); border-bottom: 2px solid #78909c; }
```

- [ ] **Step 2: Remove old SENSITIVE CSS classes**

Remove `.pg-pill-sensitive` and `.pg-highlight-sensitive` CSS rules.

- [ ] **Step 3: Verify EntityRow renders new types**

The `EntityRow.svelte` already uses `pg-pill-{entity.type.toLowerCase()}` (line 53), so new types will automatically get the correct CSS class. No Svelte changes needed.

- [ ] **Step 4: Commit**

```bash
git add src/ui/overlay/
git commit -m "feat(ui): add CSS pill/highlight colors for 9 GDPR Art.9 entity types"
```

---

### Task 11: Popup Model Labels

**Files:**
- Modify: `src/popup/popup-model.svelte.ts` (lines 128-154)

- [ ] **Step 1: Update CATEGORY_LABELS**

In `src/popup/popup-model.svelte.ts`, update CATEGORY_LABELS (lines 142-154):

```typescript
// REMOVE:
//   Sensitive: 'Sensitive',

// ADD/RENAME:
  Personal: 'Personal',     // renamed from Identity
  Health: 'Health',
  Biometric: 'Biometric',
  Beliefs: 'Beliefs',
  Identity: 'Identity',
  Criminal: 'Criminal',
```

- [ ] **Step 2: Update CATEGORY_DESCRIPTIONS**

Update CATEGORY_DESCRIPTIONS (lines 128-140):

```typescript
// REMOVE:
//   Sensitive: 'Sensitive content that requires careful handling',

// ADD/RENAME:
  Personal: 'Person names, aliases, and usernames',
  Health: 'Medical records, diagnoses, prescriptions',
  Biometric: 'Fingerprints, DNA, facial recognition',
  Beliefs: 'Religion, political opinions, trade union membership',
  Identity: 'Ethnic origin, sexual orientation',
  Criminal: 'Criminal records, convictions',
```

- [ ] **Step 3: Commit**

```bash
git add src/popup/popup-model.svelte.ts
git commit -m "feat(ui): update popup labels/descriptions for 15 groups"
```

---

### Task 12: i18n Keys

**Files:**
- Modify: `_locales/en/messages.json`
- Modify: `_locales/fr/messages.json`

- [ ] **Step 1: Add English i18n keys**

In `_locales/en/messages.json`, add after existing group keys:

```json
"groupPersonal": { "message": "Personal", "description": "Group label for personal identity" },
"groupPersonal_desc": { "message": "Person names, aliases, and usernames", "description": "Group description" },
"groupHealth": { "message": "Health", "description": "Group label for health data" },
"groupHealth_desc": { "message": "Medical records, diagnoses, prescriptions", "description": "Group description" },
"groupBiometric": { "message": "Biometric", "description": "Group label for biometric data" },
"groupBiometric_desc": { "message": "Fingerprints, DNA, facial recognition", "description": "Group description" },
"groupBeliefs": { "message": "Beliefs", "description": "Group label for beliefs data" },
"groupBeliefs_desc": { "message": "Religion, political opinions, trade union membership", "description": "Group description" },
"groupIdentity": { "message": "Identity", "description": "Group label for identity data" },
"groupIdentity_desc": { "message": "Ethnic origin, sexual orientation", "description": "Group description" },
"groupCriminal": { "message": "Criminal", "description": "Group label for criminal data" },
"groupCriminal_desc": { "message": "Criminal records, convictions", "description": "Group description" }
```

- [ ] **Step 2: Add French i18n keys**

In `_locales/fr/messages.json`, add:

```json
"groupPersonal": { "message": "Personnel", "description": "Group label for personal identity" },
"groupPersonal_desc": { "message": "Noms, alias et identifiants", "description": "Group description" },
"groupHealth": { "message": "Santé", "description": "Group label for health data" },
"groupHealth_desc": { "message": "Dossiers médicaux, diagnostics, ordonnances", "description": "Group description" },
"groupBiometric": { "message": "Biométrique", "description": "Group label for biometric data" },
"groupBiometric_desc": { "message": "Empreintes, ADN, reconnaissance faciale", "description": "Group description" },
"groupBeliefs": { "message": "Croyances", "description": "Group label for beliefs data" },
"groupBeliefs_desc": { "message": "Religion, opinions politiques, syndicat", "description": "Group description" },
"groupIdentity": { "message": "Identité", "description": "Group label for identity data" },
"groupIdentity_desc": { "message": "Origine ethnique, orientation sexuelle", "description": "Group description" },
"groupCriminal": { "message": "Criminel", "description": "Group label for criminal data" },
"groupCriminal_desc": { "message": "Casier judiciaire, condamnations", "description": "Group description" }
```

- [ ] **Step 3: Commit**

```bash
git add _locales/en/messages.json _locales/fr/messages.json
git commit -m "feat(i18n): add group labels for 5 new GDPR sub-groups (en + fr)"
```

---

### Task 13: Update Existing Tests

**Files:**
- Modify: `tests/shared/category-groups.test.ts` (line 49, and group iteration tests)
- Modify: `tests/shared/message-types.test.ts` (lines 15-52)
- Modify: `tests/shared/storage.test.ts` (if SENSITIVE references exist)
- Modify: All other test files referencing `SENSITIVE` or `Sensitive`

- [ ] **Step 1: Update category-groups.test.ts**

In `tests/shared/category-groups.test.ts`:
- Line 49: Remove `['SENSITIVE', 'Sensitive']` entry
- Add entries for the 9 new types mapped to their groups:
```typescript
['HEALTH_DATA', 'Health'],
['BIOMETRIC_DATA', 'Biometric'],
['GENETIC_DATA', 'Biometric'],
['RELIGION_OR_BELIEF', 'Beliefs'],
['POLITICAL_OPINION', 'Beliefs'],
['TRADE_UNION_MEMBERSHIP', 'Beliefs'],
['ETHNIC_ORIGIN', 'Identity'],
['SEXUAL_ORIENTATION', 'Identity'],
['CRIMINAL_OFFENCE_DATA', 'Criminal'],
```
- Update group count assertions (11 → 15)
- Rename "Identity" references to "Personal" where needed

- [ ] **Step 2: Update message-types.test.ts**

In `tests/shared/message-types.test.ts`, update the expected EntityType array (lines 15-52):
- Remove `'SENSITIVE'`
- Add the 9 new types

- [ ] **Step 3: Run all TS tests**

Run: `npx jest --config jest.config.js`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add tests/
git commit -m "test(ts): update tests for EntityType expansion and group restructuring"
```

---

### Task 14: E2E Verification

- [ ] **Step 1: Run full TS test suite**

Run: `npx jest --config jest.config.js`
Expected: All tests PASS

- [ ] **Step 2: Run full Rust test suite**

Run: `cd crate && cargo test --lib`
Expected: All tests PASS

- [ ] **Step 3: Run WASM build**

Run: `npm run build:wasm`
Expected: Build succeeds

- [ ] **Step 4: Run webpack build**

Run: `npx webpack --mode production`
Expected: Build succeeds (warnings OK)

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: GDPR Art.9 granular detection — full implementation"
```
