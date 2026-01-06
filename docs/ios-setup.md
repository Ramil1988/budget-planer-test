# iOS App Setup (Capacitor)

Capacitor wraps the React web app inside a native iOS container. Your web code runs in a WebView but looks and feels like a native app.

## Prerequisites

- macOS with Xcode installed
- Node.js 18+
- pnpm

## Initial Setup (Already Done)

### 1. Install Capacitor

```bash
cd frontend
pnpm add @capacitor/core @capacitor/cli @capacitor/ios
```

### 2. Initialize Capacitor

```bash
npx cap init "BudgetWise" "com.budgetwise.app" --web-dir dist
```

| Argument | Meaning |
|----------|---------|
| `"BudgetWise"` | App name (shown on home screen) |
| `"com.budgetwise.app"` | Bundle ID (unique identifier for App Store) |
| `--web-dir dist` | Where built web files are located |

### 3. Add iOS Platform

```bash
npx cap add ios
```

Creates `ios/` folder with full Xcode project.

## Development Workflow

After making changes to React code:

```bash
cd frontend
pnpm run build       # Build React app
npx cap sync ios     # Copy to iOS project
npx cap open ios     # Open Xcode
```

Then press **Play** (or `Cmd+R`) in Xcode to run on simulator.

## Configuration

`frontend/capacitor.config.json`:

```json
{
  "appId": "com.budgetwise.app",
  "appName": "BudgetWise",
  "webDir": "dist",
  "ios": {
    "contentInset": "automatic",
    "backgroundColor": "#ffffff"
  },
  "server": {
    "allowNavigation": ["*.supabase.co"]
  }
}
```

- `allowNavigation` - Permits API calls to Supabase

## Project Structure

```
frontend/
├── src/                 # React source code
├── dist/                # Built web files
├── ios/                 # Native iOS project
│   └── App/
│       ├── App/
│       │   └── public/  # Web files copied here
│       └── App.xcodeproj
└── capacitor.config.json
```

## Quick Reference

| Task | Command |
|------|---------|
| Build web app | `pnpm run build` |
| Sync to iOS | `npx cap sync ios` |
| Open Xcode | `npx cap open ios` |
| Full rebuild | `pnpm run build && npx cap sync ios` |

## Publishing to App Store

1. Create Apple Developer account ($99/year)
2. In Xcode: Select your Team under Signing & Capabilities
3. Set version number in Xcode project settings
4. Product > Archive
5. Upload to App Store Connect
