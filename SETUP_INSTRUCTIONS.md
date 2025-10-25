# Commonry Statistics & Authentication Setup Guide

## Overview

This guide will help you set up the complete multi-user statistics and leaderboard system for Commonry.

## What's Been Implemented

### Backend
- ✅ User authentication (signup, login, JWT tokens)
- ✅ PostgreSQL database schema with users, study sessions, and statistics tables
- ✅ Automatic statistics aggregation using database triggers
- ✅ Leaderboard system with 4 metrics (cards studied, time spent, retention rate, streak)
- ✅ RESTful API endpoints for all features

### Frontend
- ✅ Login and signup UI
- ✅ Authentication flow with JWT tokens
- ✅ Study session tracking synced with backend
- ✅ Comprehensive statistics dashboard with real-time data
- ✅ Interactive leaderboards with user rankings
- ✅ Profile page with logout functionality

## Prerequisites

1. **PostgreSQL** installed and running
2. **Node.js** (v16 or higher)
3. **npm** or **yarn**

## Setup Steps

### 1. Database Setup

Create a PostgreSQL database and run the schema:

\`\`\`bash
# Create database
createdb commonry

# Or using psql
psql -U postgres
CREATE DATABASE commonry;
\\q

# Run the schema
psql -U postgres -d commonry -f schema.sql
\`\`\`

### 2. Configure Environment Variables

Update the `.env` file with your database credentials:

\`\`\`env
DATABASE_URL=postgresql://YOUR_USERNAME:YOUR_PASSWORD@localhost:5432/commonry
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
PORT=3000
NODE_ENV=development
VITE_API_URL=http://localhost:3000
\`\`\`

**Important**: Generate a secure JWT secret for production:
\`\`\`bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
\`\`\`

### 3. Install Dependencies

\`\`\`bash
npm install
\`\`\`

### 4. Start the Backend Server

\`\`\`bash
node server.js
\`\`\`

You should see:
\`\`\`
🚀 Server running on http://localhost:3000
\`\`\`

### 5. Start the Frontend Dev Server

In a separate terminal:

\`\`\`bash
npm run dev
\`\`\`

You should see:
\`\`\`
VITE v7.1.11  ready in XXX ms
➜  Local:   http://localhost:5173/
\`\`\`

### 6. Test the Application

1. **Open** http://localhost:5173/
2. **Sign up** for a new account
3. **Import or create** some study decks
4. **Study some cards** to generate data
5. **View Statistics** page to see your progress and leaderboards

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (requires auth)

### Study Sessions
- `POST /api/study-sessions` - Record a study session
- `POST /api/study-sessions/batch` - Batch record sessions

### Statistics
- `GET /api/statistics/user/:userId?period=today|week|month|all` - Get user stats
- `GET /api/statistics/daily/:userId?startDate=&endDate=` - Get daily stats
- `GET /api/statistics/rank/:userId/:metric` - Get user rank

### Leaderboards
- `GET /api/leaderboard/:metric?limit=100` - Get top users
  - Metrics: `total_cards`, `total_time`, `retention_rate`, `current_streak`

## Database Schema

### Key Tables

1. **users** - User accounts with authentication
2. **study_sessions** - Raw study session data
3. **user_statistics_daily** - Daily aggregated stats
4. **user_statistics_total** - All-time statistics
5. **leaderboard_cache** - Cached leaderboard rankings

### Automatic Features

The database includes triggers that automatically:
- Update daily statistics when sessions are recorded
- Calculate and update total statistics
- Track current and longest streaks
- Compute retention rates

## Features

### Statistics Dashboard

- **Time Period Filtering**: View stats for today, this week, this month, or all-time
- **Personal Metrics**:
  - Cards studied
  - Time spent studying
  - Retention rate (accuracy)
  - Current streak

### Leaderboards

- **4 Different Metrics**:
  1. Total Cards Studied
  2. Total Time Spent
  3. Retention Rate (minimum 50 cards)
  4. Current Streak

- **Features**:
  - Top 100 rankings
  - Your rank display (even if outside top 100)
  - Real-time updates
  - Special highlighting for top 3 users
  - Highlight your own position

### Authentication

- Secure JWT-based authentication
- Password hashing with bcryptjs
- 7-day token expiration
- Protected API routes
- Persistent login sessions

## Troubleshooting

### Database Connection Issues

If you see database connection errors:

1. Check PostgreSQL is running:
   \`\`\`bash
   pg_isready
   \`\`\`

2. Verify credentials in `.env` file

3. Test connection manually:
   \`\`\`bash
   psql -U postgres -d commonry
   \`\`\`

### Backend Server Won't Start

1. Check port 3000 is not in use:
   \`\`\`bash
   lsof -i :3000
   \`\`\`

2. Kill existing process if needed:
   \`\`\`bash
   kill -9 <PID>
   \`\`\`

### Frontend Can't Connect to Backend

1. Verify backend is running on port 3000
2. Check `VITE_API_URL` in `.env` matches backend URL
3. Check browser console for CORS errors
4. Restart frontend dev server after changing `.env`

### Statistics Not Updating

1. Ensure you're logged in
2. Check browser console for API errors
3. Verify backend logs for errors
4. Confirm study sessions are being recorded:
   \`\`\`sql
   SELECT * FROM study_sessions ORDER BY studied_at DESC LIMIT 10;
   \`\`\`

## Development Notes

### Data Flow

1. User studies a card in `StudyView`
2. Session recorded in local IndexedDB
3. Session synced to backend PostgreSQL
4. Database triggers update statistics tables
5. Statistics page fetches and displays data

### Local-First Architecture

The app works offline:
- Study sessions stored locally in IndexedDB
- Backend sync happens asynchronously
- App continues working even if backend is down

### Security Considerations

- ✅ JWT tokens stored in localStorage
- ✅ Passwords hashed with bcrypt (10 rounds)
- ✅ SQL injection protected (parameterized queries)
- ✅ CORS enabled for development
- ✅ Rate limiting on all endpoints
- ⚠️  In production, use HTTPS only
- ⚠️  Generate strong JWT_SECRET
- ⚠️  Configure CORS for specific origins

## Next Steps

### Recommended Enhancements

1. **Data Visualization**: Add charts using Recharts (already in dependencies)
2. **Daily Goals**: Set and track daily study goals
3. **Achievements**: Unlock badges for milestones
4. **Social Features**: Follow other users, share progress
5. **Deck Sharing**: Share decks with the community
6. **Email Verification**: Add email verification to signup
7. **Password Reset**: Implement forgot password flow
8. **Profile Customization**: Avatar uploads, bio, etc.

### Production Deployment

1. Set up PostgreSQL on production server
2. Configure environment variables
3. Generate secure JWT secret
4. Build frontend: `npm run build`
5. Serve with Nginx or similar
6. Set up SSL/TLS certificates
7. Configure database backups
8. Set up monitoring and logging

## Support

For issues or questions:
- Check the GitHub issues
- Review API documentation
- Check database logs
- Enable debug logging in backend

## Architecture Diagram

\`\`\`
┌─────────────────┐
│   Frontend      │
│   (React +      │
│    Vite)        │
│                 │
│  • Auth UI      │
│  • Study View   │
│  • Stats View   │
│  • IndexedDB    │
└────────┬────────┘
         │
         │ HTTP + JWT
         │
┌────────▼────────┐
│   Backend       │
│   (Express)     │
│                 │
│  • Auth API     │
│  • Session API  │
│  • Stats API    │
│  • Leaderboard  │
└────────┬────────┘
         │
         │ SQL
         │
┌────────▼────────┐
│  PostgreSQL     │
│                 │
│  • Users        │
│  • Sessions     │
│  • Statistics   │
│  • Leaderboard  │
│  • Triggers     │
└─────────────────┘
\`\`\`

---

**Congratulations!** Your Commonry app now has a complete multi-user statistics and leaderboard system! 🎉
