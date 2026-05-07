# MySQL & Google SSO Setup Guide

## Prerequisites

1. **MySQL Server** running locally or on a network
2. **Google OAuth Credentials** (Client ID & Secret)
3. Node.js v14+

## Step 1: Configure Environment Variables

Create `.env` file in the backend directory with:

```
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=whatsapp_blaster

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

# Server
PORT=3001
FRONTEND_URL=http://localhost:5173
SESSION_SECRET=change-this-to-random-string

# Optional
SESSION_TTL_HOURS=24
```

## Step 2: Create MySQL Database

```sql
CREATE DATABASE whatsapp_blaster;
USE whatsapp_blaster;
```

## Step 3: Setup Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new Project
3. Enable Google+ API
4. Create OAuth 2.0 credentials:
   - Application Type: Web Application
   - Authorized redirect URIs: `http://localhost:3001/api/auth/google/callback`
5. Copy Client ID and Client Secret to `.env`

## Step 4: Initialize Database & Add First Admin

```bash
cd backend
npm install
node scripts/init-mysql.js
```

This script will:
- Create all necessary tables
- Add your email to the allowlist
- Display setup confirmation

## Step 5: Start Backend

```bash
npm run dev
# or for production:
npm start
```

## Step 6: Configure Frontend

Update `frontend/.env`:
```
VITE_API_BASE_URL=http://localhost:3001
```

Then start frontend:
```bash
cd frontend
npm install
npm run dev
```

## Step 7: Manage Allowed Emails

### Add Email to Allowlist

```bash
curl -X POST http://localhost:3001/api/auth/allowlist/add \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "newuser@example.com"}'
```

### View All Allowed Emails

```bash
curl http://localhost:3001/api/auth/allowlist \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Remove Email from Allowlist

```bash
curl -X POST http://localhost:3001/api/auth/allowlist/remove \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

## Step 8: Migration from SQLite to MySQL

### Database Schema
- SQLite data will NOT be automatically migrated
- All tables are fresh in MySQL
- You'll need to re-import data (contacts, templates, etc.)

### Data Migration

If you have existing SQLite data to migrate:

1. Export from SQLite:
```bash
sqlite3 backend/db/blaster.db ".mode csv" ".headers on" ".output contacts.csv" "SELECT * FROM contacts;"
```

2. Import to MySQL via UI or API endpoint (to be created)

## Authentication Flow

### Google OAuth Flow

1. User clicks "Sign in with Google"
2. Redirects to `GET /api/auth/google`
3. User authenticates with Google
4. Redirects back to `GET /api/auth/google/callback`
5. Backend creates/updates user in database
6. Redirects to frontend with token in URL: `http://localhost:5173/?token=xxx&user=yyy`
7. Frontend stores token in localStorage
8. All API calls include `Authorization: Bearer {token}` header

### Protected Routes

All routes require authentication (Bearer token):
- `/api/contacts/*`
- `/api/blast/*`
- `/api/templates/*`
- `/api/clustering/*`
- `/api/bandit/*`

Unauthenticated requests return `401 Unauthorized`

## Troubleshooting

### Google Login Not Working

1. Check if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set
2. Verify GOOGLE_CALLBACK_URL matches the one in Google Cloud Console
3. Make sure email is in allowlist

### Database Connection Error

1. Verify MySQL is running: `mysql -u root -p`
2. Check DB_HOST, DB_USER, DB_PASSWORD in .env
3. Ensure database exists: `CREATE DATABASE whatsapp_blaster;`

### Email Not Allowed

1. Email must be added to allowlist first
2. Only allowlisted emails can login
3. Use `/api/auth/allowlist/add` endpoint to add email

### Token Expired

- Default session TTL is 24 hours
- User needs to login again to get new token
- Change SESSION_TTL_HOURS in .env to adjust

## API Endpoints

### Authentication

- `GET /api/auth/google` - Start Google OAuth flow
- `GET /api/auth/google/callback` - Google OAuth callback
- `GET /api/auth/me` - Get current user info (requires auth)
- `POST /api/auth/logout` - Logout from WhatsApp
- `POST /api/auth/logout-app` - Invalidate token (requires auth)
- `GET /api/auth/allowlist` - List allowed emails (requires auth)
- `POST /api/auth/allowlist/add` - Add email (requires auth)
- `POST /api/auth/allowlist/remove` - Remove email (requires auth)

## What's Changed from Previous Version

### Before (SQLite + Username/Password)
- ✗ Username/password in .env
- ✗ SQLite file-based database
- ✗ Synchronous database calls
- ✗ In-memory session storage

### After (MySQL + Google OAuth)
- ✓ Google OAuth 2.0 authentication
- ✓ MySQL database server
- ✓ Asynchronous database operations
- ✓ Database-persisted sessions
- ✓ Email allowlist for access control
- ✓ Multi-user support
- ✓ Scalable for production

## Next Steps

1. Update route files to use async/await instead of sync queries
2. Implement data import/export functionality
3. Add admin panel for email allowlist management
4. Setup automated backups for MySQL database
5. Implement audit logging for all user actions
