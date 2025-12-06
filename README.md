# COTW Pin Planner - Grind Counter

Desktop application for tracking hunting grinds in theHunter: Call of the Wild.

## 🎯 Features

- ✅ Real-time kill counter
- ✅ Track diamonds, great ones, and rare fur types
- ✅ Comprehensive statistics
- ✅ Firebase Authentication
- ✅ Supabase database sync
- ✅ Always-on-top mode
- ✅ Global hotkeys

## 📥 Download

[Download Latest Release](../../releases/latest)

## 🔧 Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
# Install dependencies
npm install --legacy-peer-deps

# Run in development mode
npm run dev

# Build for Windows
npm run build:win
```

## 🔑 Environment Variables

Create a `.env` file:

```env
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
```

## 📝 License

Private - All rights reserved

## 🌐 Related Projects

- [COTW Pin Planner](https://cotwpinplanner.app) - Manage your hunting zones and grinds
