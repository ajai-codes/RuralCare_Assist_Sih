import json
import re
import logging
from pydantic import BaseModel, Field
from typing import List, Optional
from app.ai.prompts import CLINICAL_EXTRACTION_PROMPT
from app.ai.llm import call_llm
from app.config.settings import settings

logger = logging.getLogger("ruralcare.extraction")

class ClinicalExtractionModel(BaseModel):
    chief_complaint: str = Field(default="Not reported")
    symptoms: List[str] = Field(default_factory=list)
    onset: str = Field(default="Not reported")
    duration: str = Field(default="Not reported")
    severity: str = Field(default="Not reported")
    location: str = Field(default="Not reported")
    radiation: str = Field(default="Not reported")
    aggravating_factors: List[str] = Field(default_factory=list)
    relieving_factors: List[str] = Field(default_factory=list)
    associated_symptoms: List[str] = Field(default_factory=list)
    medical_history: str = Field(default="Not reported")
    medications: str = Field(default="Not reported")
    allergies: str = Field(default="Not reported")
    additional_information: str = Field(default="Not reported")
    clinical_summary: str = Field(default="Not reported")

def clean_and_parse_json(text: str) -> dict:
    text = text.strip()
    
    # Attempt to locate first { and last }
    start_idx = text.find('{')
    end_idx = text.rfind('}')
    
    if start_idx != -1 and end_idx != -1:
        json_str = text[start_idx:end_idx + 1]
    else:
        json_str = text
        
    # Remove potential markdown block wraps
    if json_str.startswith("```json"):
        json_str = json_str[7:]
    elif json_str.startswith("```"):
        json_str = json_str[3:]
    if json_str.endswith("```"):
        json_str = json_str[:-3]
        
    json_str = json_str.strip()
    
    # Strip comments if any
    json_str = re.sub(r'//.*', '', json_str)
    # Remove common JSON trailing commas before closing braces
    json_str = re.sub(r',\s*\}', '}', json_str)
    json_str = re.sub(r',\s*\]', ']', json_str)
    
    return json.loads(json_str)

async def extract_clinical_info(transcript: str, patient_profile: dict) -> dict:
    """
    Extracts structured clinical data from transcript using local LLM,
    validates with Pydantic, and handles demo mode fallback and safe retries.
    """
    prompt = CLINICAL_EXTRACTION_PROMPT.format(
        transcript=transcript,
        name=patient_profile.get("name", "Unknown"),
        age=patient_profile.get("age", "Unknown"),
        gender=patient_profile.get("gender", "Unknown"),
        allergies=patient_profile.get("allergies", "None reported"),
        medical_history=patient_profile.get("medical_history", "None"),
        current_medications=patient_profile.get("current_medications", "None")
    )
    
    attempts = 2
    for attempt in range(attempts):
        try:
            logger.info(f"Clinical extraction attempt {attempt + 1}...")
            response_text = await call_llm(prompt)
            parsed_data = clean_and_parse_json(response_text)
            
            # Pydantic validation and cleaning
            validated = ClinicalExtractionModel(**parsed_data)
            return validated.model_dump()
            
        except Exception as e:
            logger.warning(f"Clinical extraction attempt {attempt + 1} failed: {str(e)}")
            if attempt == attempts - 1:
                # Last attempt failed. Determine next step based on DEMO_MODE
                if settings.DEMO_MODE:
                    logger.info("DEMO_MODE is active. Using realistic mock clinical data as fallback.")
                    return run_fallback_extraction(transcript)
                else:
                    logger.error("Ollama extraction failed and DEMO_MODE is disabled.")
                    raise ConnectionError(f"Ollama clinical extraction failed: {str(e)}")

def run_fallback_extraction(transcript: str) -> dict:
    """
    Returns realistic mock clinical extraction containing all 14 fields.
    """
    t_lower = transcript.lower()
    is_chest_pain = "chest" in t_lower or "pain" in t_lower or "நெஞ்சு" in t_lower or "வலி" in t_lower
    is_cut = "laceration" in t_lower or "cut" in t_lower or "கத்தி" in t_lower or "ரத்தம்" in t_lower or "வெட்டி" in t_lower or "blood" in t_lower
    
    if is_chest_pain:
        return {
            "chief_complaint": "Chest pain radiating to left arm",
            "symptoms": ["Chest pain", "Shortness of breath", "Sweating"],
            "onset": "Yesterday evening around 8 PM",
            "duration": "Approximately 15 hours",
            "severity": "High",
            "location": "Substernal / Left chest",
            "radiation": "Left arm and left shoulder",
            "aggravating_factors": ["Exertion", "Walking", "Deep breathing"],
            "relieving_factors": ["Rest"],
            "associated_symptoms": ["Dyspnea", "Mild nausea", "Sweating"],
            "medical_history": "Mild Hypertension diagnosed 2 years ago",
            "medications": "Amlodipine 5mg once daily",
            "allergies": "None reported",
            "additional_information": "Patient appears anxious. Pain described as heavy pressure.",
            "clinical_summary": "54-year-old male reporting severe chest pain beginning yesterday evening, associated with shortness of breath and worsening with exertion."
        }
    elif is_cut:
        return {
            "chief_complaint": "Laceration on right index finger",
            "symptoms": ["Bleeding", "Laceration", "Sharp pain"],
            "onset": "30 minutes ago",
            "duration": "Acute (30 minutes)",
            "severity": "Medium",
            "location": "Right index finger, distal phalanx",
            "radiation": "None",
            "aggravating_factors": ["Movement", "Pressure"],
            "relieving_factors": ["Elevation", "Direct pressure"],
            "associated_symptoms": ["Continuous slow bleeding"],
            "medical_history": "Not reported",
            "medications": "Not reported",
            "allergies": "Penicillin (Severe rash)",
            "additional_information": "Occurred while cutting vegetables with a clean kitchen knife. Tetanus toxoid status unknown.",
            "clinical_summary": "Patient reports a deep laceration on the right index finger caused by a knife. Continuous bleeding reported."
        }
    else:
        return {
            "chief_complaint": "Knee pain and stiffness",
            "symptoms": ["Joint pain", "Stiffness", "Difficulty walking"],
            "onset": "3 days ago",
            "duration": "3 days",
            "severity": "Low",
            "location": "Right knee joint",
            "radiation": "None",
            "aggravating_factors": ["Walking", "Climbing stairs"],
            "relieving_factors": ["Rest", "Sitting down"],
            "associated_symptoms": ["Mild swelling"],
            "medical_history": "Type 2 Diabetes, Osteoarthritis",
            "medications": "Metformin 500mg BD",
            "allergies": "Sulfa drugs",
            "additional_information": "Wants blood pressure check as well.",
            "clinical_summary": "67-year-old male complains of right knee joint pain of moderate intensity for three days. Inhibiting ambulation. Requests BP review."
        }
