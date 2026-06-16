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

    let re_attr = regex::Regex::new(r"(?i)(?:né\(e?\)\s+le|âge\s*:\s*\d+|taille\s*:\s*\d+|poids\s*:\s*\d+)").unwrap();
    for m in re_attr.find_iter(text) {
        results.push(make_span(text, m.start(), m.end(), EntityType::PersonAttribute, 0.70));
    }

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

    let re_nat = regex::Regex::new(r"(?i)(?:nationalité\s*:|citoyen\(ne?\))").unwrap();
    for m in re_nat.find_iter(text) {
        results.push(make_span(text, m.start(), m.end(), EntityType::Nationality, 0.70));
    }

    let re_geo = regex::Regex::new(r"(?i)GPS\s*[-+]?\d+\.\d+\s*,\s*[-+]?\d+\.\d+").unwrap();
    for m in re_geo.find_iter(text) {
        results.push(make_span(text, m.start(), m.end(), EntityType::GeoLocation, 0.75));
    }

    let re_fin = regex::Regex::new(r"\d[\d\s]*[.,]\d{2}\s*(?:€|USD|EUR)").unwrap();
    for m in re_fin.find_iter(text) {
        results.push(make_span(text, m.start(), m.end(), EntityType::FinancialAmount, 0.70));
    }

    let re_doc = regex::Regex::new(r"(?i)(?:réf\.?\s*:\s*|numéro\s*:\s*|N°\s*)[A-Z0-9]{4,}").unwrap();
    for m in re_doc.find_iter(text) {
        results.push(make_span(text, m.start(), m.end(), EntityType::DocumentIdentifier, 0.70));
    }

    let re_ref = regex::Regex::new(r"(?i)(?:annexe\s+\d+|pièce\s+jointe)").unwrap();
    for m in re_ref.find_iter(text) {
        results.push(make_span(text, m.start(), m.end(), EntityType::DocumentReference, 0.70));
    }

    let re_vin = regex::Regex::new(r"(?i)VIN\s*:\s*[A-HJ-NPR-Z0-9]{17}").unwrap();
    for m in re_vin.find_iter(text) {
        results.push(make_span(text, m.start(), m.end(), EntityType::VehicleIdentifier, 0.75));
    }

    let re_dev = regex::Regex::new(r"(?i)(?:S/N\s*:\s*\w+|MAC\s*:\s*[0-9A-F]{2}(?::[0-9A-F]{2}){5})").unwrap();
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
