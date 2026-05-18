# Frontend Setup & Dependencies Guide

## Quick Start

### 1. Navigate to Frontend Directory
```bash
cd frontend
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Development Server
```bash
npm start
```

The frontend will open at **http://localhost:3000**

---

## Project Dependencies Overview

### Core Dependencies

#### React (^18.3.1)
- **Purpose**: JavaScript library for building user interfaces
- **Used For**: Component-based UI development, state management
- **Key Features**: JSX syntax, hooks, component composition

#### React DOM (^18.3.1)
- **Purpose**: Renders React components to the DOM
- **Used For**: Converting React components to HTML elements

#### React Router DOM (^6.30.3)
- **Purpose**: Client-side routing library
- **Used For**: Navigation between pages without full page refresh
- **Routes**:
  - `/` - Home page
  - `/login` - Login page
  - `/signup` - Registration page
  - `/search` - Medicine search page
  - `/medicine/:id` - Medicine details page
  - `/cart` - Shopping cart page
  - `/orders` - Order history page
  - `/payments` - Payment history page
  - `/profile` - User profile page
  - `/wishlist` - Favorites page
  - `/notifications` - Notifications page
  - `/shop-register` - Seller registration page
  - `/my-medicines` - Seller inventory page

#### Axios (^1.15.0)
- **Purpose**: HTTP client library for making API requests
- **Used For**: Communication with backend server
- **Configuration**: 
  - Base URL: `http://localhost:8080/api` (from `.env`)
  - Default Headers: Authorization token (when authenticated)
  - Request/Response Interceptors: Token management

#### Leaflet (^1.9.4)
- **Purpose**: JavaScript library for interactive maps
- **Used For**: Location-based medicine store features
- **Features**: Map display, location marking, distance calculation

### Development Dependencies

#### React Scripts (^5.0.1)
- **Purpose**: Build scripts and configuration for Create React App
- **Commands**:
  - `npm start` - Start development server
  - `npm build` - Create production build
  - `npm test` - Run tests
  - `npm eject` - Expose webpack configuration (not recommended)

#### @testing-library/react (^16.3.2)
- **Purpose**: Testing utilities for React components
- **Used For**: Unit testing React components

#### @testing-library/jest-dom (^6.9.1)
- **Purpose**: Custom Jest matchers for DOM elements
- **Used For**: Enhanced testing assertions

---

## Environment Configuration

### .env File (Created)
Location: `frontend/.env`

```env
REACT_APP_API_BASE_URL=http://localhost:8080/api
REACT_APP_ENV=development
```

**Important**: 
- `.env` file is automatically loaded by Create React App
- Never commit `.env` file to version control (included in `.gitignore`)
- Use `.env.example` as a template for team members

### Available Environment Variables
- `REACT_APP_API_BASE_URL` - Backend API base URL
- `REACT_APP_ENV` - Environment name (development/production)
- `REACT_APP_DEBUG` - Enable debug logging (optional)

---

## Backend Integration Points

### API Configuration (`src/api.js`)
- **Token Storage**: localStorage (key: `medcompare_token`)
- **Token Format**: `Token {token_string}`
- **Auth Header**: `Authorization: Token {token_string}`
- **Base URL**: Environment variable or `/api`

### Authentication Flow
1. User logs in via `/login` page
2. Backend returns token
3. Token stored in localStorage
4. Token automatically added to all subsequent requests (except auth endpoints)
5. Token validated on backend for each protected endpoint

### Free Endpoints (No Authentication Required)
- `/auth/login/`
- `/auth/signup/`
- `/auth/forgot-username/`
- `/auth/forgot-password/`

---

## Project Structure

```
frontend/
├── public/                 # Static files
│   └── index.html         # HTML entry point
├── src/
│   ├── pages/             # Page components
│   │   ├── Login.jsx
│   │   ├── Home.jsx
│   │   ├── Cart.jsx
│   │   ├── Orders.jsx
│   │   └── ... (other pages)
│   ├── components/        # Reusable components
│   │   ├── Navbar.jsx
│   │   ├── MedicineCard.jsx
│   │   └── LocationMapModal.jsx
│   ├── styles/            # CSS files
│   │   ├── auth.css
│   │   └── styles.css
│   ├── utils/             # Utility functions
│   ├── api.js             # API configuration
│   ├── App.js             # Main app component
│   ├── index.js           # React DOM rendering
│   └── setupTests.js      # Test configuration
├── .env                   # Environment variables (DO NOT COMMIT)
├── .env.example           # Environment template
├── .gitignore             # Git ignore rules
├── package.json           # Dependencies and scripts
└── build/                 # Production build (created after build)
```

---

## Scripts

### Available npm Scripts

#### `npm start`
- Starts development server with hot reloading
- Opens browser at http://localhost:3000
- Shows compilation errors in console
- Watches for file changes

#### `npm run build`
- Creates optimized production build
- Output: `frontend/build/` directory
- Includes minified JS and CSS

#### `npm test`
- Runs unit tests in watch mode
- Uses Jest and React Testing Library
- Tests located in `__tests__/` directories

---

## Backend Connectivity Checklist

Before starting frontend, verify:

- [x] Backend running at `http://localhost:8080`
- [x] API available at `http://localhost:8080/api`
- [x] `.env` file created with correct API URL
- [x] Authentication token format compatible (Token prefix)
- [x] CORS enabled on backend
- [x] H2 database initialized
- [x] All backend controllers compiled

---

## Troubleshooting

### "Cannot reach backend" error
1. Verify backend is running: `mvn spring-boot:run`
2. Check `.env` file has correct `REACT_APP_API_BASE_URL`
3. Verify URL is: `http://localhost:8080/api`
4. Clear browser cache: Ctrl+Shift+Delete

### "Token validation failed"
1. Try logging in again
2. Check browser developer tools (F12) → Application → localStorage
3. Verify token value exists under `medcompare_token`

### Build errors
1. Delete `node_modules/` folder
2. Delete `package-lock.json`
3. Run `npm install` again
4. Run `npm start`

### Port 3000 already in use
Change port:
```bash
PORT=3001 npm start
```

---

## Performance Optimization

The build is optimized by:
- Code splitting for lazy loading
- Minification of JavaScript and CSS
- Asset caching in localStorage
- Image optimization with lazy loading

---

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

---

## Important Notes

1. **Environment Variables**: All variables must start with `REACT_APP_` to be accessible in React
2. **Token Security**: Never expose tokens in logs or version control
3. **API Base URL**: Change `REACT_APP_API_BASE_URL` for production
4. **CORS**: Backend must allow requests from frontend origin

---

## Next Steps

1. Run `npm install` to install all dependencies
2. Verify `.env` file is in place
3. Ensure backend is running on port 8080
4. Run `npm start` to launch frontend
5. Test login/signup functionality
6. Browse medicines and add to cart
7. Complete a test purchase

---

**Last Updated**: May 13, 2026  
**Status**: ✅ Ready for Development
