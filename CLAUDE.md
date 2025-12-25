# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BudgetWise is a budget tracking application built with React, Vite, and Chakra UI. The project was migrated from vanilla HTML/CSS/JS to React (v1.0.0), then migrated from vanilla CSS to Chakra UI (v2.0.0).

**Current Version:** 2.0.0

## Documentation Structure

This project maintains comprehensive documentation in the `docs/` directory. **Always read these documents first** when working on the project:

- **`docs/architecture.md`** - Complete technical architecture, technology stack, component structure, and design patterns
- **`docs/changelog.md`** - Version history and detailed change log
- **`docs/project-status.md`** - Current status, roadmap, tasks, and priorities
- **`docs/technical-reference.md`** - Code patterns, examples, and quick reference guides

**Important:** When making significant changes:
1. Read the relevant documentation first
2. Make your changes
3. Update the appropriate documentation files
4. Add an entry to `docs/changelog.md` under `[Unreleased]`
5. Update `docs/project-status.md` if completing tasks or adding new ones

## Development Commands

**Package Manager:** This project uses `pnpm` (v10.24.0)

**Monorepo Structure:** The project is organized into `frontend/` and `backend/` directories.

From the root directory:
- `pnpm run dev` - Start both frontend and backend servers concurrently
- `pnpm run dev:frontend` - Start frontend Vite development server (runs on http://localhost:5173/)
- `pnpm run dev:backend` - Start backend NestJS server (runs on http://localhost:3000/)
- `pnpm run build` - Build both frontend and backend for production
- `pnpm run build:frontend` - Build frontend for production
- `pnpm run build:backend` - Build backend for production
- `pnpm run test:frontend` - Run frontend Playwright tests
- `pnpm run test:backend` - Run backend Jest tests
- `pnpm run install:all` - Install dependencies for root, frontend, and backend

From the frontend directory (`cd frontend`):
- `pnpm run dev` - Start Vite development server
- `pnpm run build` - Build for production
- `pnpm run preview` - Preview production build locally
- `pnpm run test` - Run Playwright tests

From the backend directory (`cd backend`):
- `pnpm run dev` - Start NestJS server in watch mode
- `pnpm run build` - Build for production
- `pnpm run start` - Start production server
- `pnpm run test` - Run Jest tests

## Architecture

### Project Structure

```
.
├── frontend/             # Frontend React application
│   ├── src/
│   │   ├── main.jsx              # Application entry point, wraps App with BrowserRouter
│   │   ├── App.jsx               # Root component with routing configuration
│   │   ├── components/           # Reusable UI components
│   │   │   ├── Header.jsx        # Navigation with mobile menu toggle
│   │   │   └── Footer.jsx        # Footer with branding
│   │   ├── pages/                # Route-level page components
│   │   │   ├── Home.jsx          # Homepage with hero and feature preview
│   │   │   └── Features.jsx      # Detailed features page
│   │   └── styles/
│   │       └── styles.css        # Global CSS with CSS custom properties
│   ├── public/                   # Static assets
│   ├── images/                   # Image assets
│   ├── tests/                    # Playwright test files
│   ├── index.html
│   ├── vite.config.js
│   ├── playwright.config.js
│   └── package.json
├── backend/              # Backend NestJS API
│   ├── src/
│   │   ├── main.ts               # Application entry point
│   │   ├── app.module.ts         # Root application module
│   │   ├── app.controller.ts     # Root controller
│   │   └── app.service.ts        # Root service
│   ├── tsconfig.json
│   ├── tsconfig.build.json
│   ├── nest-cli.json
│   └── package.json
├── docs/                 # Project documentation
└── package.json          # Root package.json with monorepo scripts
```

### Routing

React Router is configured in `App.jsx` with two routes:
- `/` - Home page (hero section, feature cards)
- `/features` - Features page (detailed feature descriptions)

The Header component uses `useLocation` hook to highlight active navigation links.

### State Management

The application uses React's built-in state management:
- **Header component:** `useDisclosure` hook (Chakra UI) for mobile menu toggle
- **Home & Features pages:** `useState` for scroll-to-top button visibility
- **Router state:** `useLocation` hook for active link detection

**Future:** Context API for budget data (see `docs/project-status.md` for roadmap)

### Styling Approach

**Current (v2.0.0):**
- Chakra UI v3.30.0 component library
- Emotion for CSS-in-JS (required by Chakra UI)
- Framer Motion for animations (required by Chakra UI)
- ChakraProvider wraps entire app in `main.jsx`
- Uses Chakra's default theme system
- Responsive props using object syntax: `{{ base: 'value', md: 'value' }}`
- No custom CSS files

**Previous (v1.0.0):**
- Single global CSS file with CSS custom properties
- Vanilla CSS with BEM-like naming
- Migrated to Chakra UI in v2.0.0

### Key Implementation Details

**Mobile Menu:**
- Uses Chakra UI's `useDisclosure` hook for toggle state
- Desktop: HStack with horizontal navigation
- Mobile: Collapsible Stack with hamburger IconButton

**Scroll-to-Top Button:**
- Managed via React useState (visibility based on scroll position)
- Appears after scrolling 300px
- Chakra UI IconButton with fixed positioning

**Feature Cards:**
- Use Chakra UI's VStack and SimpleGrid components
- Staggered animation using CSS animation delays
- Hover effects via Chakra's `_hover` prop

**Navigation:**
- React Router's `Link` wrapped in Chakra's `Box` component (`as={RouterLink}`)
- Active link highlighting using `useLocation` hook
- Color changes via Chakra's color tokens

**Images:**
- Stored in `frontend/images/` directory
- Referenced using `/images/` paths (Vite's public asset handling)
- Displayed using Chakra's `Box` component with `as="img"`

## Backend (NestJS)

The backend is built with NestJS, a progressive Node.js framework for building efficient and scalable server-side applications.

**Technology Stack:**
- **Framework:** NestJS v11.1.10
- **Runtime:** Node.js with TypeScript
- **Architecture:** Modular, following NestJS conventions
- **API Style:** RESTful (GraphQL support possible in future)

**Project Structure:**
- `src/main.ts` - Application bootstrap, sets up CORS and port configuration
- `src/app.module.ts` - Root module that imports all feature modules
- `src/app.controller.ts` - Root controller with health check endpoint
- `src/app.service.ts` - Root service with basic application logic

**Key Features:**
- CORS enabled for frontend (http://localhost:5173)
- Health check endpoint at `/health`
- TypeScript configured for decorators and metadata reflection
- Hot reload in development mode via `nest start --watch`

**Development Patterns:**
- Controllers handle HTTP requests and responses
- Services contain business logic
- Modules organize features and dependencies
- DTOs (Data Transfer Objects) for request/response validation
- Use dependency injection for all services

## Platform-Specific Notes

**macOS ARM64 (Apple Silicon):**
- The project requires `esbuild@0.27.1` and `@esbuild/darwin-arm64@0.27.1` pinned to exact versions
- If encountering esbuild platform errors, remove `node_modules` and `pnpm-lock.yaml`, then run `pnpm install --force`
- The `@rollup/rollup-darwin-arm64` package is also required for Vite to work properly

## Component Patterns

**Page Components:**
- Each page handles scroll-to-top button in local state
- Use Chakra UI's `Box` with `as="main"` for semantic HTML
- Wrapped in `Container` component (maxW="1200px") for consistent layout
- See `docs/technical-reference.md` for component templates

**Layout Components:**
- **Header:** Sticky navigation with mobile responsive menu, uses Chakra UI components
- **Footer:** Dark footer with branding, uses Chakra UI Container and VStack
- Both rendered once in App.jsx, wrapping all routes

**Chakra UI Patterns:**
- Layout: Box, Container, Flex, Stack, HStack, VStack, SimpleGrid
- Typography: Heading, Text
- Interactive: Button, IconButton
- See `docs/technical-reference.md` for detailed usage patterns
