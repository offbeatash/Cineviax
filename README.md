# Cineviax

> Cineviax is a cross-platform movie tracker app built with Expo (React Native) and a FastAPI backend. Use it to manage watchlists, mark items as watched, and keep your profile in one place.

## Quick Start

- [ ] Clone the repo
- [ ] Install backend dependencies
- [ ] Install frontend dependencies
- [ ] Run the backend server
- [ ] Start Expo for the mobile app

## Interactive Setup

```bash
# Backend from the repository root
cd backend
python -m pip install -r requirements.txt
python -m uvicorn backend.server:app --reload --host 0.0.0.0 --port 8000

# Frontend
cd ../frontend
npm install
npx expo start
```

## Project Structure

- `backend/` — FastAPI server, auth, movie endpoints, MongoDB integration
- `frontend/` — Expo app, `expo-router`, authentication, watchlist and profile screens
- `docs/` — project documentation and policies

## Features

- ✅ Signup / Login / Guest access
- ✅ Watchlist management
- ✅ Mark movies and series as watched
- ✅ Profile screen + logout control
- ✅ Web and mobile-compatible Expo frontend

## Documentation

- [Project Description](docs/description.md)
- [Privacy Policy](docs/privacy.md)
- [Changelog](docs/changelog.md)
- [Branding Guidelines](docs/branding.md)

## Useful Links

- `frontend/app/auth/login.tsx` — login screen logic
- `frontend/app/main/profile.tsx` — profile and logout anchor
- `frontend/app/main/watchlist.tsx` — watchlist UI
- `backend/server.py` — API routes and auth handlers

## Notes

If you want the app to work on a real device via Expo Go, make sure the backend base URL is reachable from your phone and you have the correct local IP in `EXPO_PUBLIC_BACKEND_URL`.

## Environment Setup

- Keep `backend/.env` out of Git. This file should contain your local secrets and private credentials.
- Use `backend/.env.example` as a template instead of committing real secrets.
- The repo already ignores `.env` files via `.gitignore`.
- For Expo Go on a device, set `EXPO_PUBLIC_BACKEND_URL=http://<YOUR_COMPUTER_IP>:8000` so your phone can reach the backend.
- If you are testing on an Android emulator, `http://10.0.2.2:8000` may work.

## Ready to use?

1. Open `backend/.env` and verify MongoDB credentials
2. Start the backend server
3. Launch Expo from `frontend/`
4. Use the profile screen to logout and manage your account
