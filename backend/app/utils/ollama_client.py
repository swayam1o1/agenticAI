import httpx
from typing import List, Dict, Any, Optional

OLLAMA_BASE_URL = "http://127.0.0.1:11434"


class OllamaClient:
    def __init__(self, base_url: str = OLLAMA_BASE_URL, model: str = "llama3"):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self._client = httpx.Client(timeout=60.0)

    def generate(self, prompt: str, system: Optional[str] = None) -> str:
        payload: Dict[str, Any] = {"model": self.model, "prompt": prompt, "stream": False}
        if system:
            payload["system"] = system

        r = self._client.post(f"{self.base_url}/api/generate", json=payload)
        r.raise_for_status()
        data = r.json()
        return data.get("response", "")

    def embeddings(self, text: str, model: Optional[str] = None) -> List[float]:
        payload: Dict[str, Any] = {"model": model or self.model, "prompt": text}
        try:
            r = self._client.post(f"{self.base_url}/api/embeddings", json=payload)
            r.raise_for_status()
            data = r.json()
            return data.get("embedding", [])
        except Exception:
            # Return zero vector on error
            return [0.0] * 4096
