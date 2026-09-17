"""
Medication Safety & Medicinal Chemistry Service
Provides active pharmaceutical ingredient (API) mapping, formulation analysis,
duplicate API detection, and drug-drug interaction warnings for RuralCare Assist.
"""

from typing import List, Dict, Any

# Comprehensive Knowledge Base for Common Rural Healthcare Medications
MEDICINAL_CHEMISTRY_DB: Dict[str, Dict[str, Any]] = {
    "paracetamol": {
        "canonical_name": "Paracetamol",
        "api": "Acetaminophen (4-acetamidophenol)",
        "cas_number": "103-90-2",
        "molecular_formula": "C8H9NO2",
        "therapeutic_class": "Analgesic & Antipyretic",
        "formulations": ["Oral Tablet (500mg/650mg)", "Oral Syrup (125mg/5ml)", "IV Infusion (1000mg/100ml)"],
        "standard_adult_dosage": "500mg - 650mg Q4-6H (Max 4000mg/day)",
        "mechanism_of_action": "Central inhibition of prostaglandin synthesis via COX-3/COX-2 pathways."
    },
    "acetaminophen": {
        "canonical_name": "Paracetamol",
        "api": "Acetaminophen (4-acetamidophenol)",
        "cas_number": "103-90-2",
        "molecular_formula": "C8H9NO2",
        "therapeutic_class": "Analgesic & Antipyretic",
        "formulations": ["Oral Tablet (500mg/650mg)", "Oral Syrup (125mg/5ml)"],
        "standard_adult_dosage": "500mg - 650mg Q4-6H (Max 4000mg/day)",
        "mechanism_of_action": "Central inhibition of prostaglandin synthesis."
    },
    "aspirin": {
        "canonical_name": "Aspirin",
        "api": "Acetylsalicylic Acid",
        "cas_number": "50-78-2",
        "molecular_formula": "C9H8O4",
        "therapeutic_class": "NSAID & Antiplatelet Agent",
        "formulations": ["Gastro-resistant Tablet (75mg/150mg)", "Chewable Tablet (300mg)"],
        "standard_adult_dosage": "75-150mg once daily (antiplatelet); 300mg stat (ACS loading)",
        "mechanism_of_action": "Irreversible inhibition of COX-1 enzyme blocking Thromboxane A2 synthesis."
    },
    "clopidogrel": {
        "canonical_name": "Clopidogrel",
        "api": "Clopidogrel Bisulfate",
        "cas_number": "120202-66-6",
        "molecular_formula": "C16H16ClNO2S·H2SO4",
        "therapeutic_class": "P2Y12 ADP Receptor Inhibitor / Antiplatelet",
        "formulations": ["Film-coated Tablet (75mg)", "Loading Dose (300mg)"],
        "standard_adult_dosage": "75mg once daily",
        "mechanism_of_action": "Irreversible binding to platelet P2Y12 ADP receptors preventing activation."
    },
    "atorvastatin": {
        "canonical_name": "Atorvastatin",
        "api": "Atorvastatin Calcium",
        "cas_number": "134523-03-8",
        "molecular_formula": "C33H35FN2O5",
        "therapeutic_class": "HMG-CoA Reductase Inhibitor (Statin)",
        "formulations": ["Film-coated Tablet (10mg/20mg/40mg/80mg)"],
        "standard_adult_dosage": "10-80mg once daily at bedtime",
        "mechanism_of_action": "Competitive inhibition of HMG-CoA reductase reducing hepatic cholesterol synthesis."
    },
    "metformin": {
        "canonical_name": "Metformin",
        "api": "Metformin Hydrochloride",
        "cas_number": "1115-70-4",
        "molecular_formula": "C4H11N5·HCl",
        "therapeutic_class": "Biguanide Antidiabetic Agent",
        "formulations": ["Immediate-release Tablet (500mg/850mg/1000mg)", "Extended-release SR (500mg/1000mg)"],
        "standard_adult_dosage": "500mg BD or 850mg BD with meals",
        "mechanism_of_action": "Decreases hepatic gluconeogenesis and increases peripheral insulin sensitivity."
    },
    "amlodipine": {
        "canonical_name": "Amlodipine",
        "api": "Amlodipine Besylate",
        "cas_number": "111470-99-6",
        "molecular_formula": "C20H25ClN2O5·C6H6O3S",
        "therapeutic_class": "Dihydropyridine Calcium Channel Blocker",
        "formulations": ["Oral Tablet (2.5mg/5mg/10mg)"],
        "standard_adult_dosage": "5-10mg once daily",
        "mechanism_of_action": "Inhibits calcium influx into vascular smooth muscle causing peripheral vasodilation."
    },
    "enalapril": {
        "canonical_name": "Enalapril",
        "api": "Enalapril Maleate",
        "cas_number": "76095-16-4",
        "molecular_formula": "C20H28N2O5·C4H4O4",
        "therapeutic_class": "ACE Inhibitor (Antihypertensive)",
        "formulations": ["Oral Tablet (2.5mg/5mg/10mg/20mg)"],
        "standard_adult_dosage": "5-20mg once daily or divided BD",
        "mechanism_of_action": "Inhibits Angiotensin-Converting Enzyme preventing conversion of Angiotensin I to II."
    },
    "amoxicillin": {
        "canonical_name": "Amoxicillin",
        "api": "Amoxicillin Trihydrate",
        "cas_number": "61336-70-7",
        "molecular_formula": "C16H19N3O5S·3H2O",
        "therapeutic_class": "Aminopenicillin Beta-Lactam Antibiotic",
        "formulations": ["Capsule (250mg/500mg)", "Dry Syrup (125mg/5ml)"],
        "standard_adult_dosage": "500mg Q8H or 875mg Q12H",
        "mechanism_of_action": "Inhibits bacterial cell wall peptidoglycan synthesis."
    },
    "cetirizine": {
        "canonical_name": "Cetirizine",
        "api": "Cetirizine Dihydrochloride",
        "cas_number": "83881-52-1",
        "molecular_formula": "C21H25ClN2O3·2HCl",
        "therapeutic_class": "Second-Generation H1 Antihistamine",
        "formulations": ["Oral Tablet (10mg)", "Syrup (5mg/5ml)"],
        "standard_adult_dosage": "10mg once daily at night",
        "mechanism_of_action": "Selective peripheral H1 receptor antagonist."
    }
}

# Known Drug Interaction Rules
DRUG_INTERACTION_RULES = [
    {
        "drugs": ["aspirin", "clopidogrel"],
        "severity": "MODERATE_BENEFIT_ALERT",
        "title": "Dual Antiplatelet Therapy (DAPT) Monitoring",
        "description": "Combination of Aspirin and Clopidogrel increases bleeding risk. Ensure indication (e.g. Acute Coronary Syndrome or Stent) justifies DAPT."
    },
    {
        "drugs": ["aspirin", "ibuprofen"],
        "severity": "HIGH",
        "title": "NSAID Antiplatelet Interference & GI Bleed Risk",
        "description": "Ibuprofen may competitively inhibit the irreversible antiplatelet effect of low-dose Aspirin and significantly elevates gastric mucosal ulcer risk."
    },
    {
        "drugs": ["enalapril", "spironolactone"],
        "severity": "HIGH",
        "title": "Severe Hyperkalemia Risk",
        "description": "Co-administration of ACE Inhibitors (Enalapril) with Potassium-Sparing Diuretics increases risk of life-threatening hyperkalemia. Monitor serum potassium."
    },
    {
        "drugs": ["metformin", "contrast_media"],
        "severity": "HIGH",
        "title": "Lactic Acidosis Risk",
        "description": "Withhold Metformin prior to iodinated radiocontrast imaging procedures due to risk of acute renal dysfunction."
    }
]

def evaluate_medication_safety(medicines: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Evaluates a list of prescribed medicine items for API chemistry details,
    duplicate active ingredient warnings, and drug-drug interaction warnings.
    """
    analyzed_items = []
    detected_apis = set()
    duplicate_warnings = []
    interaction_warnings = []
    
    found_drug_keys = []

    for idx, item in enumerate(medicines):
        med_name = (item.get("medicine") or "").strip()
        med_key = med_name.lower().split()[0] if med_name else ""
        
        info = MEDICINAL_CHEMISTRY_DB.get(med_key)
        if not info:
            # Substring match fallback
            for k, v in MEDICINAL_CHEMISTRY_DB.items():
                if k in med_name.lower():
                    info = v
                    med_key = k
                    break

        if info:
            api_name = info["api"]
            found_drug_keys.append(med_key)
            if api_name in detected_apis:
                duplicate_warnings.append({
                    "medicine": med_name,
                    "duplicate_api": api_name,
                    "warning": f"Duplicate Active Ingredient Detected: '{api_name}' is contained in multiple prescribed drugs. Risk of toxic overdose."
                })
            else:
                detected_apis.add(api_name)

            analyzed_items.append({
                "index": idx + 1,
                "medicine": med_name,
                "canonical_name": info["canonical_name"],
                "api": info["api"],
                "molecular_formula": info["molecular_formula"],
                "therapeutic_class": info["therapeutic_class"],
                "dosage_prescribed": item.get("dosage", "N/A"),
                "standard_dosage": info["standard_adult_dosage"],
                "formulations": info["formulations"],
                "mechanism": info["mechanism_of_action"]
            })
        else:
            analyzed_items.append({
                "index": idx + 1,
                "medicine": med_name,
                "canonical_name": med_name,
                "api": f"Active Ingredient for {med_name}",
                "molecular_formula": "Specified by Pharmacopeia",
                "therapeutic_class": "General Clinical Therapeutics",
                "dosage_prescribed": item.get("dosage", "N/A"),
                "standard_dosage": "As directed by physician",
                "formulations": ["Standard Formulation"],
                "mechanism": "Clinical pharmacological action as prescribed."
            })

    # Evaluate drug-drug interactions
    for rule in DRUG_INTERACTION_RULES:
        req_drugs = rule["drugs"]
        if all(d in found_drug_keys for d in req_drugs):
            interaction_warnings.append({
                "drugs_involved": [MEDICINAL_CHEMISTRY_DB[d]["canonical_name"] for d in req_drugs if d in MEDICINAL_CHEMISTRY_DB],
                "severity": rule["severity"],
                "title": rule["title"],
                "description": rule["description"]
            })

    safety_score = "PASS"
    if duplicate_warnings or any(w["severity"] == "HIGH" for w in interaction_warnings):
        safety_score = "WARNING_REQUIRES_DOCTOR_REVIEW"
    elif interaction_warnings:
        safety_score = "MONITORING_ADVISED"

    return {
        "status": "success",
        "safety_score": safety_score,
        "total_medicines_analyzed": len(medicines),
        "analyzed_items": analyzed_items,
        "duplicate_warnings": duplicate_warnings,
        "interaction_warnings": interaction_warnings,
        "clinical_disclaimer": "Assistive safety evaluation layer only. Final prescription authority remains with the attending registered medical practitioner."
    }
