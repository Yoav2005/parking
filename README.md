# ParkPass

A full-stack mobile parking spot sharing app. Drivers find available spots near them; leavers list their spot and get paid when a driver uses it.

---

## Architecture

| Layer | Technology |
|---|---|
| Backend API | Python + FastAPI |
| Database | PostgreSQL 15 |
| Cache / Pub-Sub | Redis 7 |
| ORM | SQLAlchemy (async) + Alembic |
| Auth | JWT (access + refresh tokens) |
| Payments | Stripe Connect + Payment Intents |
| Real-time | WebSockets (Redis pub/sub fan-out) |
| Background jobs | APScheduler |
| Mobile | React Native (Expo) |
| State | Zustand |
| Maps | React Native Maps (Google Maps) |

---

## Local Dev Setup

### Prerequisites

- Docker + Docker Compose
- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- A Stripe test account (see below)

---

### 1. Stripe Test Account Setup

1. Go to [https://dashboard.stripe.com](https://dashboard.stripe.com) and create an account.
2. Switch to **Test mode** (toggle in the top-left).
3. Go to **Developers → API keys**:
   - Copy your **Publishable key** (`pk_test_...`) → use in `frontend/.env`
   - Copy your **Secret key** (`sk_test_...`) → use in `backend/.env`
4. Go to **Developers → Webhooks → Add endpoint**:
   - URL: `http://localhost:8000/stripe/webhook` (use [ngrok](https://ngrok.com) for local testing)
   - Events to listen: `payment_intent.succeeded`, `payment_intent.payment_failed`
   - Copy the **Signing secret** (`whsec_...`) → use in `backend/.env`
5. To test Stripe Connect, enable it under **Settings → Connect**.

---

### 2. Backend

```bash
cd backend

# Copy and fill in env vars
cp .env.example .env
# Edit .env with your Stripe keys

# Start everything (Postgres, Redis, FastAPI)
docker-compose up --build
```

The API will be available at **http://localhost:8000**
Interactive docs: **http://localhost:8000/docs**

Migrations run automatically on startup via `alembic upgrade head`.

---

### 3. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Copy and fill in env vars
cp .env.example .env
# Set EXPO_PUBLIC_API_URL to your machine's local IP, e.g.:
# EXPO_PUBLIC_API_URL=http://192.168.1.100:8000
# (use your LAN IP, not localhost, so the device/simulator can reach it)

# Start Expo
npx expo start
```

- Press `i` for iOS Simulator
- Press `a` for Android Emulator
- Scan QR code with Expo Go on a physical device

#### Google Maps setup (required for map view)

1. Get an API key from [Google Cloud Console](https://console.cloud.google.com) with **Maps SDK for iOS** and **Maps SDK for Android** enabled.
2. Add to `frontend/.env`: `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_key`
3. For iOS: add to `app.json` under `expo.ios.config.googleMapsApiKey`
4. For Android: add to `app.json` under `expo.android.config.googleMaps.apiKey`

---

## API Reference

All responses follow: `{ "success": bool, "data": any, "error": string | null }`

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Register with email + password |
| POST | `/auth/login` | Login, receive JWT tokens |
| POST | `/auth/refresh` | Refresh access token |

### Spots
| Method | Path | Description |
|---|---|---|
| POST | `/spots` | Create a spot listing (auth) |
| GET | `/spots/nearby?lat=&lng=&radius_km=2` | Get available spots within radius |
| GET | `/spots/{id}` | Get spot detail |
| PATCH | `/spots/{id}/cancel` | Cancel your listing (auth) |

### Reservations
| Method | Path | Description |
|---|---|---|
| POST | `/reservations` | Reserve a spot + create PaymentIntent |
| POST | `/reservations/{id}/confirm-arrival` | Driver confirms they arrived |
| POST | `/reservations/{id}/cancel` | Cancel + refund (if before arrival) |

### Payments
| Method | Path | Description |
|---|---|---|
| POST | `/payments/create-connect-account` | Onboard leaver to Stripe Connect |
| GET | `/payments/connect-status` | Check Connect account status |

### Ratings
| Method | Path | Description |
|---|---|---|
| POST | `/ratings` | Rate after completed reservation |

### WebSocket
| Path | Description |
|---|---|
| `WS /ws/spots` | Stream real-time spot events |

WebSocket message format:
```json
{ "event": "spot_created" | "spot_reserved" | "spot_cancelled" | "spot_expired", "data": { ... } }
```

---

## Payment Flow

1. **Driver** calls `POST /reservations` → receives `client_secret`
2. **Driver** calls `stripe.confirmPayment(client_secret)` in the app
3. Stripe charges the driver and routes funds:
   - **85%** → leaver's Stripe Connect account
   - **15%** → platform (your Stripe account)
4. **Cancellation before arrival** → full refund via `Refund.create`
5. **Cancellation after arrival** → no refund

---

## Background Jobs (APScheduler)

Two jobs run every minute:

| Job | Description |
|---|---|
| `expire_stale_spots` | Marks `AVAILABLE` spots `EXPIRED` after 30 minutes |
| `auto_cancel_reservations` | Cancels `ACTIVE` reservations 15 min after arrival confirmed, issues refund |

---

## Race Condition Handling

When two drivers tap "Reserve" simultaneously, the backend uses `SELECT ... FOR UPDATE NOWAIT` on the spot row. The second transaction gets an `OperationalError` which is caught and returned as a `409 Conflict`.

---

## Project Structure

```
parking/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, WebSocket endpoint
│   │   ├── api/
│   │   │   ├── deps.py          # Auth dependency
│   │   │   └── routes/          # auth, spots, reservations, payments, ratings
│   │   ├── core/
│   │   │   ├── config.py        # Settings (pydantic-settings)
│   │   │   ├── database.py      # Async SQLAlchemy engine + session
│   │   │   └── security.py      # JWT + bcrypt
│   │   ├── models/              # SQLAlchemy ORM models
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   ├── services/
│   │   │   ├── payment_service.py
│   │   │   ├── spot_service.py
│   │   │   └── background_tasks.py
│   │   └── websocket/
│   │       └── manager.py       # Redis pub/sub WebSocket fan-out
│   ├── alembic/                 # DB migrations
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── .env.example
└── frontend/
    ├── App.tsx                  # Root navigator
    ├── src/
    │   ├── api/                 # Axios API calls
    │   ├── components/          # SpotPin, SpotCard, RatingModal
    │   ├── hooks/               # useLocation, useWebSocket
    │   ├── screens/             # Auth, Map, CreateSpot, SpotDetail, Reservation, Profile
    │   └── store/               # Zustand slices (auth, spots)
    ├── app.json
    └── .env.example
```
