import sys

def verify():
    modules = ["fastapi", "google.genai", "psycopg2", "pgvector", "telebot"]
    success = True
    print("Verifying backend module imports...")
    for mod in modules:
        try:
            __import__(mod)
            print(f"  [PASS] {mod} imported successfully.")
        except ImportError as e:
            print(f"  [FAIL] Failed to import {mod}: {str(e)}")
            success = False
            
    if success:
        print("All modules loaded successfully! ✅")
        sys.exit(0)
    else:
        print("Some imports failed. ❌")
        sys.exit(1)

if __name__ == "__main__":
    verify()
