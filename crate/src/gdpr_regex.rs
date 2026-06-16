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
    let medical_ctx = ["médical", "medical", "santé", "health", "patient",
                        "traitement", "treatment", "cancer", "diabète", "diabetes",
                        "hypertension", "chirurgie", "surgery", "hospitalisation",
                        "hospitalization", "ordonnance", "prescription"];

    let fr_kw = ["diagnostic", "ordonnance", "traitement", "patient",
                  "dossier médical", "assurance maladie", "mutuelle",
                  "hospitalisation", "chirurgie", "cancer", "diabète", "hypertension"];
    let en_kw = ["diagnosis", "prescription", "treatment", "patient",
                  "medical record", "health insurance", "hospitalization",
                  "surgery", "cancer", "diabetes", "hypertension"];

    for kw in fr_kw.iter().chain(en_kw.iter()) {
        let mut search_start = 0;
        while let Some(pos) = lower[search_start..].find(kw) {
            let abs_pos = search_start + pos;
            let end = abs_pos + kw.len();
            if has_context(text, abs_pos, 50, &medical_ctx) {
                results.push(make_span(text, abs_pos, end, EntityType::HealthData, 0.85));
            }
            search_start = end;
        }
    }

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
                  "scanner rétinien", "profil génétique"];
    let en_kw = ["fingerprint", "facial recognition", "iris scan",
                  "retinal scan", "genetic profile"];

    for kw in fr_kw.iter().chain(en_kw.iter()) {
        let mut search_start = 0;
        while let Some(pos) = lower[search_start..].find(kw) {
            let abs_pos = search_start + pos;
            let end = abs_pos + kw.len();
            results.push(make_span(text, abs_pos, end, EntityType::BiometricData, 0.80));
            search_start = end;
        }
    }

    let adn_kw = ["adn", "génotype", "séquençage génomique", "dna", "genotype", "genome sequencing"];
    for kw in &adn_kw {
        let mut search_start = 0;
        while let Some(pos) = lower[search_start..].find(kw) {
            let abs_pos = search_start + pos;
            let end = abs_pos + kw.len();
            results.push(make_span(text, abs_pos, end, EntityType::GeneticData, 0.80));
            search_start = end;
        }
    }

    let re_dna = regex::Regex::new(r"(?i)(?:ADN|DNA)/[A-Z0-9]{6}").unwrap();
    for m in re_dna.find_iter(text) {
        results.push(make_span(text, m.start(), m.end(), EntityType::GeneticData, 0.90));
    }

    results
}

pub fn detect_beliefs(text: &str) -> Vec<PiiSpan> {
    let mut results = Vec::new();
    let lower = text.to_lowercase();

    let religion_kw = ["religion", "croyance", "église", "mosquée", "synagogue",
                        "temple", "church", "mosque"];
    let political_kw = ["parti politique", "political party", "democrat", "republican",
                         "labour", "conservative"];
    let union_kw = ["syndicat", "adhérent", "membre", "cgt", "cfdt", "udi",
                     "lrem", "trade union"];

    for kw in &religion_kw {
        let mut search_start = 0;
        while let Some(pos) = lower[search_start..].find(kw) {
            let abs_pos = search_start + pos;
            let end = abs_pos + kw.len();
            results.push(make_span(text, abs_pos, end, EntityType::ReligionOrBelief, 0.75));
            search_start = end;
        }
    }

    for kw in &political_kw {
        let mut search_start = 0;
        while let Some(pos) = lower[search_start..].find(kw) {
            let abs_pos = search_start + pos;
            let end = abs_pos + kw.len();
            results.push(make_span(text, abs_pos, end, EntityType::PoliticalOpinion, 0.75));
            search_start = end;
        }
    }

    for kw in &union_kw {
        let mut search_start = 0;
        while let Some(pos) = lower[search_start..].find(kw) {
            let abs_pos = search_start + pos;
            let end = abs_pos + kw.len();
            results.push(make_span(text, abs_pos, end, EntityType::TradeUnionMembership, 0.75));
            search_start = end;
        }
    }

    let re_mem = regex::Regex::new(r"(?i)(?:N°\s*adhérent|membership\s*(?:number|no|#))\s*\d+").unwrap();
    for m in re_mem.find_iter(text) {
        results.push(make_span(text, m.start(), m.end(), EntityType::TradeUnionMembership, 0.90));
    }

    results
}

pub fn detect_identity(text: &str) -> Vec<PiiSpan> {
    let mut results = Vec::new();
    let lower = text.to_lowercase();

    let ethnic_kw = ["origine ethnique", "race", "ethnie", "ethnic origin", "ethnicity"];
    let sexual_kw = ["orientation sexuelle", "genre", "identité de genre",
                      "sexual orientation", "gender identity"];

    for kw in &ethnic_kw {
        let mut search_start = 0;
        while let Some(pos) = lower[search_start..].find(kw) {
            let abs_pos = search_start + pos;
            let end = abs_pos + kw.len();
            results.push(make_span(text, abs_pos, end, EntityType::EthnicOrigin, 0.70));
            search_start = end;
        }
    }

    for kw in &sexual_kw {
        let mut search_start = 0;
        while let Some(pos) = lower[search_start..].find(kw) {
            let abs_pos = search_start + pos;
            let end = abs_pos + kw.len();
            results.push(make_span(text, abs_pos, end, EntityType::SexualOrientation, 0.70));
            search_start = end;
        }
    }

    results
}

pub fn detect_criminal(text: &str) -> Vec<PiiSpan> {
    let mut results = Vec::new();
    let lower = text.to_lowercase();
    let criminal_ctx = ["judiciaire", "criminal", "tribunal", "court", "condamnation", "conviction"];

    let fr_kw = ["casier judiciaire", "condamnation", "peine", "tribunal",
                  "infraction", "conviction", "procès", "arrestation", "garde à vue"];
    let en_kw = ["criminal record", "conviction", "sentence", "court",
                  "offence", "felony", "misdemeanor", "arrest", "detention"];

    for kw in fr_kw.iter().chain(en_kw.iter()) {
        let mut search_start = 0;
        while let Some(pos) = lower[search_start..].find(kw) {
            let abs_pos = search_start + pos;
            let end = abs_pos + kw.len();
            if has_context(text, abs_pos, 50, &criminal_ctx) {
                results.push(make_span(text, abs_pos, end, EntityType::CriminalOffenceData, 0.85));
            }
            search_start = end;
        }
    }

    let re_b2 = regex::Regex::new(r"B2/\d{7}").unwrap();
    for m in re_b2.find_iter(text) {
        results.push(make_span(text, m.start(), m.end(), EntityType::CriminalOffenceData, 0.95));
    }

    results
}

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
