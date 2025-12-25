# BudgetWise

A modern budget tracking application built with React, Vite, and Chakra UI.

## Project Structure

This is a monorepo containing:
- **frontend/** - React frontend application
- **backend/** - Backend API (coming soon)

## Development

**Package Manager:** This project uses `pnpm` (v10.24.0)

### Getting Started

1. Install dependencies:
```bash
pnpm run install:all
```

2. Start the frontend development server:
```bash
pnpm run dev:frontend
```

The application will be available at http://localhost:5173/

### Available Scripts

From the root directory:
- `pnpm run dev:frontend` - Start frontend development server
- `pnpm run dev:backend` - Start backend server (not yet implemented)
- `pnpm run build:frontend` - Build frontend for production
- `pnpm run build:backend` - Build backend for production
- `pnpm run test:frontend` - Run frontend tests
- `pnpm run install:all` - Install all dependencies

## Documentation

See the `docs/` directory for comprehensive documentation:
- `docs/architecture.md` - Technical architecture and design patterns
- `docs/changelog.md` - Version history
- `docs/project-status.md` - Current status and roadmap
- `docs/technical-reference.md` - Code patterns and examples

## Technology Stack

### Frontend
- React 19.2.3
- Vite 7.3.0
- Chakra UI 3.30.0
- React Router 7.11.0
- Playwright (testing)

### Backend
- Coming soon

## License

ISC
