import httpx
import logging
from app.config.settings import settings

logger = logging.getLogger("ruralcare.llm")

async def call_llm(prompt: str) -> str:
    """
    Sends a generation request to the local LLM runtime (supports Ollama and llama.cpp).
    """
    # 1. Try Ollama runtime first
    ollama_url = f"{settings.LLM_BASE_URL.rstrip('/')}/api/generate"
    ollama_payload = {
        "model": settings.LLM_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.1
        }
    }
    
    logger.info(f"Connecting to LLM (Ollama format) at {ollama_url} for model {settings.LLM_MODEL}")
    
    # Fast online check to fail fast if offline
    is_online = False
    try:
        with httpx.Client(timeout=0.5) as client:
            res = client.get(settings.LLM_BASE_URL.rstrip("/"))
            if res.status_code == 200:
                is_online = True
    except Exception:
        pass
        
    if not is_online:
        raise ConnectionError("Local LLM runtime is unreachable.")

    try:
        async with httpx.AsyncClient(timeout=2.5) as client:
            response = await client.post(ollama_url, json=ollama_payload)
            if response.status_code == 200:
                data = response.json()
                text = data.get("response", "").strip()
                return clean_markdown_fences(text)
    except Exception as e:
        logger.warning(f"Ollama generation failed ({str(e)}). Trying llama.cpp compatibility format...")

    # 2. Try llama.cpp compatibility endpoint (/completion)
    llamacpp_url = f"{settings.LLM_BASE_URL.rstrip('/')}/completion"
    llamacpp_payload = {
        "prompt": prompt,
        "temperature": 0.1,
        "n_predict": 1024,
        "stream": False
    }
    
    logger.info(f"Connecting to LLM (llama.cpp format) at {llamacpp_url}")
    try:
        async with httpx.AsyncClient(timeout=2.5) as client:
            response = await client.post(llamacpp_url, json=llamacpp_payload)
            if response.status_code == 200:
                data = response.json()
                text = data.get("content", "").strip()
                return clean_markdown_fences(text)
    except Exception as e:
        logger.error(f"llama.cpp generation failed: {str(e)}")

    raise ConnectionError("Local LLM runtime is unreachable or failed to generate completions.")

def clean_markdown_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()
