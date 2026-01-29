# LuminPath 🎨✨

**AR Light Trail Navigation System** - Create and follow magical light trails in Augmented Reality!

## 🚀 Features

- **🎨 Paint Mode**: Walk and create glowing AR trails
- **🧭 Follow Mode**: Navigate using AR visual guides
- **☁️ Cloud Sync**: Save trails to Supabase (free!)
- **📱 PWA**: Install as app on mobile devices
- **🌐 WebAR**: No app install needed - works in browser
- **🎯 GPS Navigation**: Real-world positioning
- **✨ Visual Effects**: Multiple trail styles and colors

## 🛠️ Tech Stack

- **Frontend**: HTML5, A-Frame, AR.js, Three.js
- **Backend**: Supabase (PostgreSQL + Realtime)
- **Hosting**: Any static hosting (Netlify, Vercel, GitHub Pages)
- **Database**: PostgreSQL with JSONB for trail data

## 📦 Setup Instructions

### 1. **Supabase Setup (FREE)**
1. Go to [supabase.com](https://supabase.com)
2. Sign up (no credit card required)
3. Create new project: `luminpath`
4. Go to **SQL Editor** and run the SQL from `database.sql`
5. Go to **Settings → API** and copy:
   - Project URL
   - `anon` public key

### 2. **Configure Supabase**
Edit `supabase-config.js`:
``javascript
const SUPABASE_URL = 'YOUR_PROJECT_URL_HERE';
const SUPABASE_KEY = 'YOUR_ANON_KEY_HERE';

### 3. **Local Development**
# Install simple HTTP server
npm install -g http-server

# Run server
http-server -p 8080

# Open in browser
http://localhost:8080

### 📱 Usage Guide
Creating Trails
Open LuminPath on mobile
Grant camera & location permissions
Tap 🎨 Paint Mode
Choose color & style
Tap ▶ Start Painting
Walk your desired path
Tap 💾 Save Trail when done

### Following Trails
Tap 🧭 Follow Mode
Select a trail from list
Tap 🚶‍♂️ Start Following
Follow the glowing AR path

AR cursor shows direction
