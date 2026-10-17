# SmartChair Mobile (Android, iOS & Tablet — React Native / Expo)

Native mobile & tablet application for **SmartChair**, sharing the unified MongoDB database and real-time `Socket.io` backend with the Telegram Web Mini App.

## Key Features
- **1-Tap Telegram Bot Deep-Link Auth (`/api/mobile/auth/telegram/start`)**: Opens your official Telegram Bot (`tg://resolve?domain=<bot>&start=login_<token>`), links the user's real `telegramId`, and immediately pushes a signed 30-day JWT back to the mobile app via Socket.io (`auth:<sessionToken>`).
- **Real-Time Live Sync (`Socket.io`)**:
  - `booking:updated`: Live status changes when a barber confirms, rejects, reschedules, or completes a booking in Telegram or the Admin Panel.
  - `availability:updated`: Live time-slot updates (`public:shop:<shopId>`) when another customer on Web or Mobile books or cancels an appointment.
  - `favorites:updated` & `user:updated`: Instant sync of saved barbershops and profile details across Web and Mobile.
- **Phone, Foldable & Tablet Responsiveness (`src/hooks/useResponsive.js`)**:
  - Automatically adapts between 1-column (phone), 2-column (portrait tablet), and 3-column (landscape tablet) shop grids.
  - Side-by-side **Shop List + Map split-view** on tablets (`app/(tabs)/map.jsx`).
  - Two-column **Master-Detail** layout on Shop Details (`app/shop/[id].jsx`) and Booking (`app/booking/[id].jsx`).
- **Native Animations & Haptics**: Built with `react-native-reanimated` spring physics and `expo-haptics`.

## Getting Started

1. **Install dependencies**:
   ```bash
   cd /Users/a1/Downloads/barbershop-mobile
   npm install
   ```

2. **Configure backend URL**:
   Copy `.env.example` to `.env` and set your backend URL:
   ```bash
   cp .env.example .env
   ```
   - For Android Emulator: `EXPO_PUBLIC_BACKEND_URL=http://10.0.2.2:5000`
   - For physical Android/iOS device on Wi-Fi: `EXPO_PUBLIC_BACKEND_URL=http://<YOUR_MAC_LAN_IP>:5000`
   - For production: `EXPO_PUBLIC_BACKEND_URL=https://<your-backend-domain>`

3. **Run on Android or iOS**:
   ```bash
   npx expo start --android
   # or for iOS later:
   npx expo start --ios
   ```
