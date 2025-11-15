# Discourse Forum Integration Guide

This guide explains how to set up and configure the Discourse forum integration for Commonry. The integration provides **Single Sign-On (SSO)** so users can seamlessly access the forum with their Commonry account.

## 📋 Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Discourse Setup](#discourse-setup)
- [Commonry Configuration](#commonry-configuration)
- [Environment Variables](#environment-variables)
- [How It Works](#how-it-works)
- [Testing the Integration](#testing-the-integration)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

The Discourse integration enables:

- **Single Sign-On (SSO)**: Users log in to Discourse using their Commonry credentials
- **Automatic Account Sync**: User profiles (username, email, display name, avatar) sync automatically
- **Seamless Experience**: One-click access to the forum from "The Square" page
- **Recent Activity Display**: Show recent forum topics on The Square page

### Architecture

```
User clicks "Enter Forum" on The Square
          ↓
Redirected to Commonry SSO Endpoint (/api/discourse/sso)
          ↓
Commonry validates JWT token & user
          ↓
Commonry generates signed SSO payload
          ↓
User redirected back to Discourse with signed data
          ↓
Discourse validates signature & logs user in
```

## 🔧 Prerequisites

1. **Discourse Installation**: You need a running Discourse instance (e.g., `https://forum.commonry.app`)
2. **Admin Access**: Admin access to your Discourse installation
3. **HTTPS**: Both Discourse and Commonry must use HTTPS in production

## 🔐 Discourse Setup

### Step 1: Enable DiscourseConnect (SSO)

1. Log in to your Discourse admin panel
2. Navigate to **Settings** → **Login**
3. Find the **DiscourseConnect** settings section
4. Configure the following:

```
enable_discourse_connect = true
discourse_connect_url = https://your-commonry-domain.com/api/discourse/sso
discourse_connect_secret = [generate a strong random secret - see below]
```

### Step 2: Generate SSO Secret

Generate a strong random secret for signing SSO payloads:

```bash
# On Linux/Mac:
openssl rand -hex 32

# Or use Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Important**: Keep this secret secure! It's used to sign SSO data and must match between Discourse and Commonry.

### Step 3: Configure Additional Settings

Optional but recommended settings:

```
discourse_connect_overrides_avatar = true
discourse_connect_overrides_bio = true
discourse_connect_overrides_email = false
discourse_connect_overrides_username = false
```

### Step 4: (Optional) Disable Other Login Methods

To enforce SSO-only access:

```
enable_local_logins = false
enable_google_oauth2_logins = false
enable_twitter_logins = false
# etc.
```

## ⚙️ Commonry Configuration

### Step 1: Set Environment Variables

Add the following to your `.env` file:

```bash
# Discourse SSO Configuration
DISCOURSE_SSO_SECRET=your_generated_secret_from_discourse_setup
DISCOURSE_URL=https://forum.commonry.app

# Frontend Environment Variables (for Vite)
VITE_DISCOURSE_URL=https://forum.commonry.app
VITE_DISCOURSE_API_KEY=optional_discourse_api_key_for_reading_posts
```

**Notes**:

- `DISCOURSE_SSO_SECRET` must match the secret you set in Discourse
- `DISCOURSE_URL` is your forum's base URL
- `VITE_DISCOURSE_API_KEY` is optional - only needed if you want to display recent posts on The Square

### Step 2: Restart Your Servers

After adding environment variables:

```bash
# Restart backend server
npm run server  # or however you run server.js

# Restart frontend dev server
npm run dev
```

### Step 3: (Optional) Create Discourse API Key

To fetch recent forum posts for display on The Square:

1. In Discourse admin panel, go to **API** → **Keys**
2. Click **New API Key**
3. Configure:
   - **Description**: "Commonry recent posts"
   - **User Level**: "All Users"
   - **Scopes**: Select "Read posts", "Read topics"
4. Generate and copy the key to `VITE_DISCOURSE_API_KEY`

## 📝 Environment Variables Reference

### Backend (.env)

| Variable               | Required | Description                   | Example                      |
| ---------------------- | -------- | ----------------------------- | ---------------------------- |
| `DISCOURSE_SSO_SECRET` | ✅ Yes   | Shared secret for SSO signing | `a1b2c3d4e5f6...` (64 chars) |
| `DISCOURSE_URL`        | ✅ Yes   | Your Discourse forum base URL | `https://forum.commonry.app` |

### Frontend (Vite .env)

| Variable                 | Required    | Description                        | Example                      |
| ------------------------ | ----------- | ---------------------------------- | ---------------------------- |
| `VITE_DISCOURSE_URL`     | ✅ Yes      | Forum URL (for frontend API calls) | `https://forum.commonry.app` |
| `VITE_DISCOURSE_API_KEY` | ⚪ Optional | API key for reading posts          | `your-api-key-here`          |
| `VITE_API_URL`           | ✅ Yes      | Commonry backend URL               | `https://api.commonry.app`   |

## 🔄 How It Works

### SSO Flow (Detailed)

1. **User Clicks "Enter Forum"**
   - Frontend: `SquareView.tsx` redirects to `/api/discourse/sso`
   - Request includes user's JWT token via Authorization header

2. **Commonry Validates Request**
   - Backend: `server.js` → `/api/discourse/sso` endpoint
   - `authenticateToken` middleware validates JWT
   - Fetches user profile from PostgreSQL

3. **Check Email Verification**
   - Ensures `email_verified = true`
   - Returns 403 error if email not verified

4. **Generate SSO Payload**
   - Module: `discourse-sso.js` → `generateDiscoursePayload()`
   - Creates payload with user data:
     ```javascript
     {
       nonce: discourse_nonce,
       external_id: user_id,      // Commonry ULID
       email: user_email,
       username: user_username,
       name: user_display_name,
       avatar_url: user_avatar_url,  // optional
       bio: user_bio,                 // optional
       require_activation: false,
       suppress_welcome_message: true
     }
     ```

5. **Sign Payload**
   - HMAC-SHA256 signature using `DISCOURSE_SSO_SECRET`
   - Payload is base64-encoded

6. **Redirect to Discourse**
   - User redirected to: `{return_sso_url}?sso={payload}&sig={signature}`

7. **Discourse Validates & Logs In**
   - Discourse validates signature with shared secret
   - Creates or updates user account
   - Logs user into Discourse session

### Recent Posts Display

1. **Frontend Loads The Square**
   - `SquareView.tsx` → `useEffect` hook
   - Calls `getLatestTopics()` from `discourse-api.ts`

2. **Fetch from Discourse API**
   - GET request to `{DISCOURSE_URL}/latest.json`
   - Public endpoint (no auth required)
   - Optional: Include `Api-Key` header if configured

3. **Display Topics**
   - Shows recent 6 topics
   - Links directly to Discourse threads

## 🧪 Testing the Integration

### 1. Test Without SSO (Direct Discourse Access)

Visit your Discourse URL directly:

```
https://forum.commonry.app
```

- Should redirect to Commonry SSO endpoint
- If not configured, you'll see login page

### 2. Test SSO Flow

1. Log in to Commonry
2. Navigate to "The Square" page
3. Click "Enter Forum" button
4. Should:
   - Redirect through Commonry SSO endpoint
   - Auto-login to Discourse
   - Land on Discourse home page

### 3. Verify User Data Sync

Check that user profile data syncs correctly:

1. In Discourse, click your avatar → Profile
2. Verify:
   - Username matches Commonry username
   - Email matches Commonry email
   - Display name matches Commonry display_name
   - Avatar (if you have one set in Commonry)

### 4. Test Recent Posts Display

1. Create a few topics/posts on Discourse
2. Return to The Square on Commonry
3. Recent topics should appear at the bottom

## 🐛 Troubleshooting

### Error: "SSO not configured on server"

**Cause**: `DISCOURSE_SSO_SECRET` environment variable not set

**Solution**:

1. Ensure `.env` file contains `DISCOURSE_SSO_SECRET`
2. Restart your backend server
3. Verify with: `console.log(process.env.DISCOURSE_SSO_SECRET)` in server.js

### Error: "Invalid SSO signature or payload"

**Cause**: SSO secret mismatch between Discourse and Commonry

**Solution**:

1. Verify both systems use the exact same secret
2. Check for extra whitespace in environment variables
3. Regenerate secret and update both systems

### Error: "Email must be verified before accessing the forum"

**Cause**: User hasn't verified their email in Commonry

**Solution**:

1. Check user's `email_verified` status in database
2. Resend verification email from login page
3. Complete email verification flow

### Forum Doesn't Show Recent Topics

**Cause**: Discourse API endpoint not accessible or API key invalid

**Solution**:

1. Test API endpoint manually: `curl https://forum.commonry.app/latest.json`
2. Check CORS settings on Discourse if getting blocked
3. Verify `VITE_DISCOURSE_URL` is correct
4. Check browser console for errors

### Users Can't Access Forum (403 Error)

**Cause**: Email not verified or account not active

**Solution**:

1. Verify user's `email_verified = true` in database:
   ```sql
   SELECT username, email_verified FROM users WHERE username = 'username';
   ```
2. Ensure `is_active = true`
3. Have user complete email verification

### SSO Redirect Loop

**Cause**: Misconfigured `discourse_connect_url` in Discourse

**Solution**:

1. Verify `discourse_connect_url` ends with `/api/discourse/sso`
2. Ensure URL uses HTTPS (not HTTP) in production
3. Check for trailing slashes

## 🔐 Security Considerations

1. **HTTPS Required**: Always use HTTPS in production for both Commonry and Discourse
2. **Secret Storage**: Never commit `DISCOURSE_SSO_SECRET` to version control
3. **Secret Strength**: Use a cryptographically secure random secret (32+ bytes)
4. **Token Validation**: SSO endpoint requires valid JWT token
5. **Email Verification**: Users must verify email before forum access
6. **Timing-Safe Comparison**: Signature validation uses `crypto.timingSafeEqual()`

## 📁 Integration Files

### Backend

- `discourse-sso.js` - SSO utilities (signature validation, payload generation)
- `server.js` - SSO endpoint (`/api/discourse/sso`)

### Frontend

- `src/components/SquareView.tsx` - The Square page component
- `src/services/discourse-api.ts` - Discourse API client
- `src/App.tsx` - Updated to use SquareView instead of placeholder

### Documentation

- `DISCOURSE_INTEGRATION.md` - This file

## 📚 Additional Resources

- [Discourse DiscourseConnect Official Guide](https://meta.discourse.org/t/discourseconnect-official-single-sign-on-for-discourse-sso/13045)
- [Discourse API Documentation](https://docs.discourse.org/)
- [Discourse SSO Implementation Examples](https://meta.discourse.org/t/discourse-sso-implementation-examples/187789)

## 🤝 Support

If you encounter issues:

1. Check this guide's Troubleshooting section
2. Review Discourse admin logs: `/admin/logs`
3. Check Commonry backend logs for SSO errors
4. Test SSO signature generation manually

---

**Last Updated**: 2025-01-14
**Commonry Version**: 1.0.0
**Discourse Version**: 3.0+
