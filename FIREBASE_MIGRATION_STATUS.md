# Firebase Migration Guide

Backend now uses Firebase as primary auth/session store.

## Required env in backend/.env
- STORAGE_PROVIDER=firebase
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback
- FIREBASE_SERVICE_ACCOUNT_JSON (or FIREBASE_SERVICE_ACCOUNT_PATH)

## Current migration status
- Migrated to Firebase:
  - /api/auth (google login, session token, allowlist)
- Temporarily disabled with 503 in firebase mode:
  - /api/contacts
  - /api/blast
  - /api/templates
  - /api/clustering
  - /api/bandit

## Next migration targets
1. contacts + templates collections
2. blast sessions/logs/queue collections
3. bandit policies/events collections
4. clustering metadata/features collections
