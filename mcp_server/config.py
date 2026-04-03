import os

# Database config
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
DB_NAME = os.getenv("DB_NAME", "floatchat_ai")

PROFILES_COLLECTION = "profiles"
BGC_PROFILES_COLLECTION = "bgc_profiles"
FLOATS_COLLECTION = "floats"
