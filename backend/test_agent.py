#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.memory import FAISSMemory
from app.agent import StudyAgent
from app.storage import Storage

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
CHAT_DB = os.path.join(DATA_DIR, "chat.db")
OLLAMA_MODEL = "llama3.2"

try:
    print("Initializing memory...")
    memory = FAISSMemory(data_dir=DATA_DIR, embed_model=OLLAMA_MODEL)
    print("Initializing storage...")
    storage = Storage(f"sqlite:///{CHAT_DB}")
    print("Initializing agent...")
    agent = StudyAgent(memory=memory, model=OLLAMA_MODEL, storage=storage)
    print("Running agent...")
    result = agent.run(task="tutor", user_input="explain arrays", history=[], session_id=None)
    print("Result:", result)
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
