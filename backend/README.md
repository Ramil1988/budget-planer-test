# BudgetWise Backend

NestJS-based REST API for the BudgetWise budget tracking application.

## Technology Stack

- **Framework:** NestJS v11.1.10
- **Runtime:** Node.js with TypeScript
- **Architecture:** Modular, following NestJS conventions
- **Package Manager:** pnpm v10.24.0

## Getting Started

### Installation

```bash
pnpm install
```

### Development

Start the development server with hot reload:

```bash
pnpm run dev
```

The API will be available at `http://localhost:3000`

### Build

Build for production:

```bash
pnpm run build
```

### Running in Production

```bash
pnpm run start:prod
```

## API Endpoints

### Root
- `GET /` - Welcome message

### Health Check
- `GET /health` - Returns API health status and timestamp

## Project Structure

```
backend/
├── src/
│   ├── main.ts              # Application entry point
│   ├── app.module.ts        # Root application module
│   ├── app.controller.ts    # Root controller
│   └── app.service.ts       # Root service
├── dist/                    # Compiled JavaScript (generated)
├── tsconfig.json            # TypeScript configuration
├── tsconfig.build.json      # TypeScript build configuration
├── nest-cli.json            # NestJS CLI configuration
└── package.json
```

## Development Guidelines

### Creating a New Module

Use the NestJS CLI:

```bash
nest generate module <module-name>
nest generate controller <module-name>
nest generate service <module-name>
```

### CORS Configuration

CORS is enabled for the frontend development server:
- Origin: `http://localhost:5173`
- Credentials: enabled

Update `src/main.ts` to modify CORS settings for production.

## Available Scripts

- `pnpm run dev` - Start development server with watch mode
- `pnpm run build` - Build for production
- `pnpm run start` - Start production server
- `pnpm run start:debug` - Start with debugger
- `pnpm run test` - Run unit tests
- `pnpm run test:watch` - Run tests in watch mode
- `pnpm run test:cov` - Run tests with coverage
- `pnpm run test:e2e` - Run end-to-end tests

## Next Steps

- Add database integration (PostgreSQL/MongoDB)
- Implement authentication and authorization
- Create budget management endpoints
- Add data validation with DTOs and class-validator
- Set up environment configuration
- Add API documentation with Swagger
