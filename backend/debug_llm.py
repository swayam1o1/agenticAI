import sys
from app.utils.ollama_client import OllamaClient
llm = OllamaClient()
prompt = """You are an expert AI tutor.
Your ONLY task is to generate highly effective study flashcards.
Output the flashcards strictly as a valid JSON array of objects. Do not write anything outside the JSON. Minimum 5 cards.
Format: [{"front": "string", "back": "string"}]

Target these Weak Topics:
- Python Dictionaries: Understanding hash maps
"""
res = llm.generate(prompt)
print("===RAW===")
print(repr(res))
print("=========")
