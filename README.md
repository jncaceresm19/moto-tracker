# Moto Tracker 

A mobile application for motorcycle maintenance tracking.

## Features

- **Kilometer Tracking**: Log and monitor your motorcycle's mileage
- **Maintenance Records**: Track oil changes, tire changes, brake checks, and more
- **Document Management**: Store and manage circulation permits, technical reviews, insurance, and registration documents
- **Service Reminders**: Get notifications for upcoming maintenance based on kilometers or dates
- **Multi-Motorcycle Support**: Manage multiple motorcycles in one account

## Tech Stack

### Mobile (Frontend)
- **React Native** with **Expo** (SDK 57)
- **TypeScript** for type safety
- **React Navigation** for routing (planned)
- **AsyncStorage** for local data persistence (planned)

### Backend (API)
- **Node.js** with **Express** (v5)
- **TypeScript** for type safety
- **Drizzle ORM** for database operations
- **SQLite** for local development database
- **JWT** for authentication
- **Zod** for request validation

### Shared
- **TypeScript** types and interfaces
- **Common utilities** for both mobile and backend

## Project Structure

```
moto-tracker/
├── packages/
│   ├── mobile/          # React Native (Expo) mobile app
│   ├── backend/         # Node.js/Express API server
│   └── shared/          # Shared types and utilities
├── package.json         # Root package.json with workspaces
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+ (recommended: 22)
- npm or yarn
- Expo CLI (for mobile development)
- Android Studio or Xcode (for mobile testing)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd moto-tracker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Development

#### Backend API
```bash
cd packages/backend
npm run dev
```

The API server will start on `http://localhost:3001`

#### Mobile App
```bash
cd packages/mobile
npm start
```

This will start the Expo development server. You can then:
- Press `a` to open on Android emulator
- Press `i` to open on iOS simulator (macOS only)
- Scan the QR code with Expo Go app on your phone

### Testing

#### Backend Tests
```bash
cd packages/backend
npm test                    # Run tests once
npm run test:watch          # Run tests in watch mode
npm run test:coverage       # Run tests with coverage report
```

#### Mobile Tests
```bash
cd packages/mobile
npm test
```

### Type Checking

```bash
# From root
npm run typecheck

# Or per package
cd packages/backend && npm run typecheck
cd packages/shared && npm run typecheck
```

## Database Schema

The application uses SQLite with Drizzle ORM. The schema includes:

- **users**: User accounts
- **motorcycles**: Motorcycle information
- **maintenance_records**: Service and maintenance history
- **documents**: Important documents (permits, insurance, etc.)
- **kilometer_history**: Mileage tracking over time

## API Endpoints (Planned)

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/motorcycles` - Get user's motorcycles
- `POST /api/motorcycles` - Add new motorcycle
- `GET /api/motorcycles/:id` - Get motorcycle details
- `POST /api/motorcycles/:id/maintenance` - Add maintenance record
- `GET /api/motorcycles/:id/documents` - Get motorcycle documents
- `POST /api/motorcycles/:id/kilometers` - Log kilometer reading

## Environment Variables

Create a `.env` file in `packages/backend/`:

```env
PORT=3001
JWT_SECRET=your-secret-key-here
DATABASE_URL=./data/moto-tracker.db
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with Expo and React Native
- Database powered by Drizzle ORM and SQLite
- Authentication with JWT
