import requests

BASE = "http://127.0.0.1:8001"

def main():
    print("Health:", requests.get(f"{BASE}/api/health").json())
    # Add sample memory
    r = requests.post(f"{BASE}/api/memory", files={"file": ("sample.txt", b"Photosynthesis is the process plants use to convert light energy into chemical energy.")})
    print("Memory:", r.json())
    # Tutor call
    payload = {"task": "tutor", "input": "Explain photosynthesis."}
    r = requests.post(f"{BASE}/api/agent", json=payload)
    print("Tutor output keys:", list(r.json().keys()))

if __name__ == "__main__":
    main()
