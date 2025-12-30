# PagerDuty-Lite Frontend

React + TypeScript frontend for PagerDuty-Lite incident management system.

## Tech Stack

- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite
- **UI Components:** Shadcn/ui + Tailwind CSS
- **Routing:** React Router v6
- **State Management:** Zustand
- **Forms:** React Hook Form + Zod
- **HTTP Client:** Axios
- **Icons:** Lucide React

## Getting Started

### Prerequisites

- Node.js 20.19+ or 22.12+ (recommended for best performance)
- npm 10+

### Installation

```bash
npm install
```

### Development

Run the development server with hot reload:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Building for Production

Build the application for production:

```bash
npm run build
```

The build output will be in the `dist/` directory, which is served by the Express backend.

### Preview Production Build

Preview the production build locally:

```bash
npm run preview
```

## Project Structure

```
frontend/
├── src/
│   ├── components/      # Reusable UI components
│   │   ├── ui/         # Shadcn UI components
│   │   └── ProtectedRoute.tsx
│   ├── pages/          # Page components
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Incidents.tsx
│   │   └── Schedules.tsx
│   ├── lib/            # Utilities and clients
│   │   ├── api-client.ts  # Axios API client
│   │   └── utils.ts       # Helper functions
│   ├── store/          # State management
│   │   └── auth-store.ts  # Zustand auth store
│   ├── types/          # TypeScript types
│   │   └── api.ts         # API response types
│   ├── App.tsx         # Main app component with routing
│   ├── main.tsx        # Application entry point
│   └── index.css       # Global styles
├── public/             # Static assets
└── dist/              # Production build output (generated)
```

## Features

- **Authentication:** Login and registration with JWT tokens
- **Protected Routes:** Automatic redirect to login for unauthenticated users
- **Incident Management:** View, acknowledge, and resolve incidents
- **Schedule Management:** View on-call schedules and rotations
- **Responsive Design:** Mobile-friendly interface
- **Dark Mode Ready:** CSS custom properties for theme switching

## API Integration

The frontend communicates with the backend API at `/api/v1`. The API client:
- Automatically injects JWT tokens from localStorage
- Handles 401 errors with redirect to login
- Provides typed methods for all API endpoints

## Development Notes

### Node Version Warning

If you see warnings about Node.js version (Vite requires 20.19+ or 22.12+), the build will still succeed on Node 18, but upgrading is recommended for better performance:

```bash
# Using nvm
nvm install 20
nvm use 20

# Or using apt (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
