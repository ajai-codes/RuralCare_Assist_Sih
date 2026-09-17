import logging
from app.config.settings import settings

logger = logging.getLogger("ruralcare.triage")

async def recommend_triage_priority(clinical_info: dict, patient_profile: dict) -> dict:
    """
    Determines preliminary triage priority using deterministic Python rules
    based on the extracted clinical information.
    """
    logger.info("Determining triage priority using deterministic Python rules...")
    
    chief_complaint = (clinical_info.get("chief_complaint") or "").lower()
    symptoms = [s.lower() for s in clinical_info.get("symptoms", [])]
    summary = (clinical_info.get("clinical_summary") or "").lower()
    severity = (clinical_info.get("severity") or "").lower()
    
    factors = []
    level = "ROUTINE"
    confidence = 0.85
    explanation = ""
    
    # 1. EMERGENCY checks: Immediate threat to life, airway, breathing, circulation
    emergency_keywords = [
        "chest pain", "shortness of breath", "breathing difficulty", "dyspnea",
        "stroke", "unconscious", "seizure", "severe bleeding", "heart attack",
        "cardiac", "chest pressure", "நெஞ்சு வலி", "மூச்சு"
    ]
    
    is_emergency = False
    
    for kw in emergency_keywords:
        if kw in chief_complaint or kw in summary or any(kw in s for s in symptoms):
            is_emergency = True
            factors.append(f"Critical symptom detected: '{kw}'")
            
    if severity in ["high", "severe", "critical"]:
        is_emergency = True
        factors.append("Clinical severity is rated as High/Severe")
        
    if is_emergency:
        level = "EMERGENCY"
        confidence = 0.95
        explanation = (
            "The patient presents with signs suggesting potential acute cardiovascular or respiratory distress, "
            "or high severity symptoms requiring immediate professional review. The triage priority is set to EMERGENCY."
        )
    else:
        # 2. URGENT checks: Serious but not immediately life-threatening conditions
        urgent_keywords = [
            "laceration", "cut", "wound", "bleeding", "fracture", "burn", "fever",
            "vomiting", "acute pain", "infection", "injury", "கத்தி", "காயம்", "ரத்தம்"
        ]
        is_urgent = False
        
        for kw in urgent_keywords:
            if kw in chief_complaint or kw in summary or any(kw in s for s in symptoms):
                is_urgent = True
                factors.append(f"Urgent symptom detected: '{kw}'")
                
        if severity in ["medium", "moderate"]:
            is_urgent = True
            factors.append("Clinical severity is rated as Medium/Moderate")
            
        if is_urgent:
            level = "URGENT"
            confidence = 0.88
            explanation = (
                "The patient presents with acute issues such as lacerations, active bleeding, localized pain, "
                "or systemic symptoms like fever requiring prompt medical evaluation. The triage priority is set to URGENT."
            )
        else:
            # 3. ROUTINE: Stable, chronic, or minor issues
            level = "ROUTINE"
            confidence = 0.90
            factors.append("Symptoms are consistent with chronic, stable, or minor conditions")
            explanation = (
                "The patient presents with symptoms indicating a non-acute, routine, or chronic primary care concern "
                "(such as joint pain, general checkup, or BP reviews) suitable for normal queue scheduling."
            )
            
    # Normalize to match database enums and front-end values
    db_level = level.upper() # EMERGENCY, URGENT, ROUTINE
    api_priority = level.capitalize() # Emergency, Urgent, Routine (front-end compatibility)
    
    return {
        "triage_level": db_level,
        "ai_priority": api_priority,
        "ai_confidence": int(confidence * 100),
        "confidence": confidence,
        "contributing_factors": factors,
        "explanation": explanation,
        "reason": explanation
    }
