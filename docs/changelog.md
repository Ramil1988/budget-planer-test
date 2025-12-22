# Changelog

All notable changes to the BudgetWise project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Budget entry form
- Data persistence (localStorage)
- Budget visualization charts
- Export functionality
- Dark mode support

---

## [2.0.0] - 2025-12-21

### Major Changes
**Migration from Vanilla CSS to Chakra UI**

This is a breaking change that completely rewrites the UI implementation while maintaining all functionality.

### Added
- Chakra UI component library v3.30.0
- Emotion for CSS-in-JS styling (required by Chakra UI)
- Framer Motion for animations (required by Chakra UI)
- Comprehensive documentation structure:
  - `docs/architecture.md` - Technical architecture documentation
  - `docs/changelog.md` - This file
  - `docs/project-status.md` - Project status and roadmap
  - `docs/technical-reference.md` - Technical guides and references

### Changed
- **Header Component:** Converted to Chakra UI components
  - Uses `Box`, `Flex`, `HStack`, `IconButton`, `Stack`, `Text`
  - Replaced manual CSS classes with Chakra props
  - Mobile menu now uses `useDisclosure` hook
  - Improved responsive design with Chakra's responsive props

- **Footer Component:** Converted to Chakra UI components
  - Uses `Box`, `Container`, `Flex`, `Text`, `VStack`
  - Cleaner layout with Chakra's spacing system

- **Home Page:** Converted to Chakra UI components
  - Uses `Box`, `Container`, `Flex`, `Heading`, `Text`, `Button`, `SimpleGrid`, `VStack`, `IconButton`
  - Improved responsive layout
  - Scroll-to-top button now uses React state instead of DOM manipulation
  - Removed CSS animations in favor of Chakra's built-in animation support

- **Features Page:** Converted to Chakra UI components
  - Uses `Box`, `Container`, `Flex`, `Heading`, `Text`, `Button`, `VStack`, `Stack`, `IconButton`
  - Feature lists converted from HTML lists to Chakra Stack components
  - Alternating layout pattern uses Chakra's flex-direction responsive props
  - Removed gray background from hero section for cleaner look

- **Main Entry Point:** Added ChakraProvider wrapper
  - Wraps entire app with Chakra UI theme system
  - Uses `defaultSystem` from Chakra UI v3

### Removed
- `src/styles/styles.css` - Replaced entirely with Chakra UI
- CSS custom properties (replaced with Chakra's theme system)
- Manual CSS class management
- styled-jsx usage (not needed with Chakra UI)
- Unused component imports (`useColorModeValue`, `List`, `ListItem`)

### Fixed
- Import errors with non-existent Chakra UI exports
- Mobile menu toggle behavior now more robust with `useDisclosure`
- Improved accessibility with Chakra's built-in ARIA attributes
- Consistent spacing throughout the app using Chakra's spacing scale

### Technical Details
- Package manager: pnpm v10.24.0
- Build tool: Vite v7.2.7
- React version: v19.2.3
- React Router: v7.10.1

---

## [1.0.0] - 2025-12-20 (Estimated)

### Initial Release
**Migration from Vanilla HTML/CSS/JS to React**

### Added
- React-based component architecture
- React Router for client-side routing
- Vite build system and dev server
- Playwright end-to-end testing setup
- Header component with mobile menu toggle
- Footer component
- Home page with hero section and feature preview
- Features page with detailed feature descriptions
- Responsive design (mobile-first approach)
- Custom CSS with CSS custom properties
- Scroll-to-top button functionality
- Active navigation link highlighting
- Smooth scroll behavior
- Feature card animations (fade-in with stagger)

### Components
- `Header.jsx` - Navigation with mobile menu
- `Footer.jsx` - Site footer with branding
- `Home.jsx` - Landing page
- `Features.jsx` - Features showcase page
- `App.jsx` - Root routing component
- `main.jsx` - Application entry point

### Pages/Routes
- `/` - Home page
- `/features` - Features page

### Styling
- Global CSS file (`src/styles/styles.css`)
- CSS custom properties for theming
- BEM-like naming conventions
- Responsive breakpoint: 768px
- Mobile-first design approach

### Platform Support
- macOS ARM64 (Apple Silicon) optimizations
- Pinned esbuild version for platform compatibility

---

## Version History Summary

- **v2.0.0** (2025-12-21): Chakra UI migration + comprehensive documentation
- **v1.0.0** (2025-12-20): Initial React migration from vanilla HTML/CSS/JS

---

## Update Guidelines

When updating this changelog:

1. Add new entries under `[Unreleased]` section
2. Use the following categories:
   - `Added` - New features
   - `Changed` - Changes to existing functionality
   - `Deprecated` - Soon-to-be removed features
   - `Removed` - Removed features
   - `Fixed` - Bug fixes
   - `Security` - Security fixes
3. When releasing a version, move `[Unreleased]` items to a new version section
4. Include the date in ISO format (YYYY-MM-DD)
5. Link to issues/PRs when applicable
6. Keep it concise but informative

## Notes

- This project follows semantic versioning
- Major version changes indicate breaking changes (like the CSS → Chakra UI migration)
- Minor version changes add functionality in a backwards-compatible manner
- Patch version changes are backwards-compatible bug fixes
