# Architecture Documentation

**Last Updated:** 2025-12-21

## Overview

BudgetWise is a budget tracking application built with React and Chakra UI. The application follows a modern component-based architecture with client-side routing.

## Technology Stack

### Core Framework
- **React** v19.2.3 - UI library
- **Vite** v7.2.7 - Build tool and dev server
- **React Router** v7.10.1 - Client-side routing

### UI Framework
- **Chakra UI** v3.30.0 - Component library
- **Emotion** v11.14.0 - CSS-in-JS styling (required by Chakra UI)
- **Framer Motion** v12.23.26 - Animation library (required by Chakra UI)

### Testing
- **Playwright** v1.57.0 - End-to-end testing

### Package Manager
- **pnpm** v10.24.0

## Project Structure

```
budget-planner/
├── docs/                      # Documentation
│   ├── architecture.md        # This file
│   ├── changelog.md          # Version history
│   ├── project-status.md     # Current status and roadmap
│   └── technical-reference.md # Technical details and guides
├── images/                    # Static images
│   ├── hero-dashboard.png
│   ├── visual.jpg
│   ├── goal-tracking.png
│   ├── alerts.png
│   └── OCR.jpg
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── Header.jsx       # Navigation header with mobile menu
│   │   └── Footer.jsx       # Footer with branding
│   ├── pages/               # Route-level page components
│   │   ├── Home.jsx         # Homepage with hero and features preview
│   │   └── Features.jsx     # Detailed features page
│   ├── App.jsx              # Root component with routing
│   └── main.jsx             # Application entry point
├── tests/                    # Playwright tests
├── .gitignore
├── CLAUDE.md                 # Claude Code guidance
├── package.json
├── vite.config.js
└── playwright.config.js
```

## Component Architecture

### Layout Components

#### Header (`src/components/Header.jsx`)
- **Purpose:** Primary navigation with mobile-responsive menu
- **State Management:** Uses `useDisclosure` hook for mobile menu toggle
- **Routing:** Implements active link highlighting using `useLocation`
- **Responsive Behavior:**
  - Desktop: Horizontal navigation with HStack
  - Mobile: Hamburger menu with collapsible Stack

#### Footer (`src/components/Footer.jsx`)
- **Purpose:** Site footer with branding
- **State:** Stateless component
- **Layout:** Uses Chakra UI Container, Flex, and VStack

### Page Components

#### Home (`src/pages/Home.jsx`)
- **Purpose:** Landing page with hero section and features preview
- **Features:**
  - Hero section with CTA button
  - Feature cards grid (3 cards)
  - Scroll-to-top button (appears after scrolling 300px)
- **State:**
  - `showScrollTop` - Controls scroll-to-top button visibility
- **Effects:**
  - Scroll event listener for scroll-to-top button

#### Features (`src/pages/Features.jsx`)
- **Purpose:** Detailed features page with alternating image/text layouts
- **Features:**
  - Page hero section
  - 4 detailed feature sections with images
  - Call-to-action section
  - Scroll-to-top button
- **Layout Pattern:** Alternating flex-direction for visual variety
- **State:**
  - `showScrollTop` - Controls scroll-to-top button visibility

### Routing Configuration

Defined in `src/App.jsx`:
- `/` → Home page
- `/features` → Features page

## Styling System

### Chakra UI Configuration

The app uses Chakra UI's default theme system with the following approach:

1. **ChakraProvider** wraps the entire app in `main.jsx`
2. **Default System** using `defaultSystem` from Chakra UI v3
3. **Responsive Props** using object syntax: `{{ base: 'value', md: 'value' }}`

### Color Palette

Primary colors used throughout the app:
- **Primary Blue:** `blue.600` - Main brand color, CTAs, links
- **Gray Scale:**
  - `gray.50` - Light backgrounds
  - `gray.200` - Borders
  - `gray.400` - Muted text
  - `gray.600` - Secondary text
  - `gray.800` - Footer background

### Responsive Breakpoints

Chakra UI's default breakpoints:
- `base`: 0px (mobile-first)
- `sm`: 480px
- `md`: 768px (primary breakpoint used in app)
- `lg`: 992px
- `xl`: 1280px
- `2xl`: 1536px

### Layout Constraints

- **Max Width:** 1200px for main content containers
- **Padding:** 8 (32px) horizontal padding on containers
- **Vertical Spacing:** 16 (64px) between major sections

## State Management

Currently using React's built-in state management:

### Component State (useState)
- Header: Mobile menu open/close state
- Home/Features: Scroll-to-top button visibility

### Router State (useLocation)
- Header: Active link detection

### Future Considerations
- For budget data: Consider Context API or state management library
- For forms: React Hook Form integration
- For server state: TanStack Query (React Query)

## Performance Considerations

### Current Optimizations
- Vite's fast HMR (Hot Module Replacement)
- React 19's automatic batching
- Chakra UI's built-in CSS optimization

### Animation Strategy
- Scroll-to-top button uses React state (not CSS classes)
- Hover effects use Chakra's `_hover` prop
- Feature cards use CSS animation delays (staggered effect)

## Platform-Specific Notes

### macOS ARM64 (Apple Silicon)
- Requires `esbuild@0.27.1` pinned to exact version
- Requires `@esbuild/darwin-arm64@0.27.1`
- Requires `@rollup/rollup-darwin-arm64` for Vite

If encountering platform errors:
1. Remove `node_modules` and `pnpm-lock.yaml`
2. Run `pnpm install --force`

## Development Workflow

### Running the App
```bash
pnpm run dev        # Start dev server at http://localhost:5173
pnpm run build      # Production build
pnpm run preview    # Preview production build
```

### Testing
```bash
pnpm test           # Run Playwright tests
pnpm test:ui        # Playwright UI mode
pnpm test:headed    # Run tests in headed browser
pnpm test:debug     # Debug mode
pnpm test:report    # Show test report
```

## Future Architecture Considerations

### Potential Enhancements
1. **State Management:** Implement Context API for budget data
2. **Data Persistence:** Local storage or backend integration
3. **Forms:** Add budget entry forms with validation
4. **Charts:** Integrate chart library (e.g., Recharts, Chart.js)
5. **Authentication:** User accounts and data sync
6. **API Integration:** Backend for data persistence
7. **PWA:** Progressive Web App capabilities
8. **Dark Mode:** Chakra UI color mode toggle

### Scalability
- Component structure supports easy addition of new pages
- Chakra UI theme can be customized with brand tokens
- Current folder structure scales to medium-sized applications
- For large apps, consider feature-based folder structure
