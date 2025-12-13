# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BudgetWise is a budget tracking application built with React and Vite. The project was migrated from vanilla HTML/CSS/JS to React, maintaining all original functionality while adopting modern React patterns.

## Development Commands

**Package Manager:** This project uses `pnpm` (v10.24.0)

- `pnpm run dev` - Start Vite development server (runs on http://localhost:5173/)
- `pnpm run build` - Build for production
- `pnpm run preview` - Preview production build locally

## Architecture

### Application Structure

```
src/
├── main.jsx              # Application entry point, wraps App with BrowserRouter
├── App.jsx               # Root component with routing configuration
├── components/           # Reusable UI components
│   ├── Header.jsx        # Navigation with mobile menu toggle
│   └── Footer.jsx        # Footer with branding
├── pages/                # Route-level page components
│   ├── Home.jsx          # Homepage with hero and feature preview
│   └── Features.jsx      # Detailed features page
└── styles/
    └── styles.css        # Global CSS with CSS custom properties
```

### Routing

React Router is configured in `App.jsx` with two routes:
- `/` - Home page (hero section, feature cards)
- `/features` - Features page (detailed feature descriptions)

The Header component uses `useLocation` hook to highlight active navigation links.

### State Management

The application uses React's built-in state management:
- **Header component:** `useState` for mobile menu toggle state
- **Home & Features pages:** `useEffect` hooks for scroll-based UI (scroll-to-top button, animations)

### Styling Approach

- Single global CSS file (`src/styles/styles.css`) with CSS custom properties for theming
- Uses vanilla CSS with BEM-like class naming conventions
- Responsive design with mobile-first breakpoints at 768px
- No CSS-in-JS or CSS modules currently used

### Key Implementation Details

**Mobile Menu:** Toggled via React state in Header component, synced with hamburger icon (☰/✕)

**Scroll Animations:**
- Scroll-to-top button dynamically created/removed in useEffect cleanup
- Feature cards use staggered fade-in animations with CSS animation-delay

**Navigation:**
- Uses React Router's `Link` components for client-side navigation
- Active link highlighting based on current pathname

**Images:**
- Stored in `/images` directory at project root
- Referenced from components using `/images/` paths (Vite's public asset handling)

## Platform-Specific Notes

**macOS ARM64 (Apple Silicon):**
- The project requires `esbuild@0.27.1` and `@esbuild/darwin-arm64@0.27.1` pinned to exact versions
- If encountering esbuild platform errors, remove `node_modules` and `pnpm-lock.yaml`, then run `pnpm install --force`
- The `@rollup/rollup-darwin-arm64` package is also required for Vite to work properly

## Component Patterns

**Page Components:**
- Each page component handles its own scroll-related effects in `useEffect`
- Cleanup functions properly remove event listeners and DOM elements
- Pages are wrapped in `<main>` with `.main-container` for consistent layout

**Layout Components:**
- Header and Footer are rendered once in App.jsx, wrapping all routes
- Header manages its own mobile menu state internally
- Footer is purely presentational with no state
