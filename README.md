# Scheduling Module (Beginner-Friendly)

A simple full-stack scheduling project built for learning:

1. User registration and login
2. Cookie-based authentication (JWT stored in HTTP-only cookie)
3. Schedule CRUD (create, list, update, delete)
4. Frontend and backend running on different ports with CORS

## Final Organized Structure

```text
.
├── backend/
│   ├── server.js
│   ├── config/
│   │   └── db.js
│   ├── middleware/
│   │   └── authMiddleware.js
│   ├── modules/
│   │   ├── users/
│   │   │   ├── userController.js
│   │   │   ├── userModel.js
│   │   │   └── userRoutes.js
│   │   └── schedules/
│   │       ├── scheduleController.js
│   │       ├── scheduleModel.js
│   │       └── scheduleRoutes.js
│   └── utils/
│       └── jwt.js
├── frontend/
│   ├── public/
│   │   ├── css/
│   │   │   └── style.css
│   │   └── js/
│   │       └── dashboard.js
│   └── views/
│       ├── login.html
│       └── dashboard.html
├── .gitignore
├── package.json
├── package-lock.json
└── README.md
```

## Running the Application

### Backend
```bash
npm install
npm start
# or for development with auto-reload:
npm run dev
```
Backend runs on `http://localhost:4000`

### Frontend
Open `frontend/views/login.html` directly in your browser, or use a simple static server:
```bash
# Option 1: Python (if available)
cd frontend && python -m http.server 3000

# Option 2: Node.js global http-server
npx http-server frontend -p 3000
```
Frontend will be accessible at the URL shown (e.g., `http://localhost:3000` or `http://127.0.0.1:3000`)

### CORS Configuration
- Frontend and backend run on different ports
- Backend (`http://localhost:4000`) is configured with CORS to accept requests from frontend origins
- Cookies are sent with all frontend-to-backend requests (HTTP-only, `credentials: 'include'`)

## Ports and URLs

- Frontend: Accessible at file system or via static server (e.g., `http://localhost:3000`)
- Backend API: `http://localhost:4000`

Frontend files calling backend:

- `frontend/views/login.html` - Login/Register page
- `frontend/public/js/dashboard.js` - Schedule dashboard logic

## Tech Stack

- Node.js
- Express.js
- MongoDB + Mongoose
- Vanilla HTML/CSS/JS
- JWT + Cookies

## Backend File Explanation

### `backend/server.js`

- Creates Express app.
- Configures CORS for cross-port frontend/backend communication.
- Handles preflight `OPTIONS` requests.
- Parses JSON and cookies.
- Mounts routes:
  - `/api/users`
  - `/api/schedules`
- Starts backend server on port `4000` after DB connect.

### `backend/config/db.js`

- Connects Mongoose to MongoDB using hardcoded Atlas URL.
- Exits process if DB connection fails.

### `backend/middleware/authMiddleware.js`

- Reads auth token from cookie `token`.
- Verifies JWT.
- Attaches decoded user to `req.user`.
- Blocks unauthorized requests.

### `backend/utils/jwt.js`

- `generateToken(user)` creates JWT with basic user payload.
- `verifyToken(token)` validates JWT.
- Uses hardcoded JWT secret in code.

### `backend/modules/users/userModel.js`

Simplified schema:

- `name` (required)
- `email` (required, unique)
- `password` (required)

### `backend/modules/users/userController.js`

- `register`: validates input, hashes password, saves user.
- `login`: validates credentials, sets HTTP-only cookie.
- `logout`: clears cookie.
- `me`: returns current logged-in user.

### `backend/modules/users/userRoutes.js`

- `POST /api/users/register`
- `POST /api/users/login`
- `POST /api/users/logout`
- `GET /api/users/me` (protected)

### `backend/modules/schedules/scheduleModel.js`

Simplified schema:

- `eventName`
- `roundName`
- `roundNumber`
- `date`
- `startTime`
- `endTime`
- `venue`
- `status` (default: `scheduled`)

### `backend/modules/schedules/scheduleController.js`

- `createSchedule`
- `getAllSchedules`
- `updateSchedule`
- `deleteSchedule`

### `backend/modules/schedules/scheduleRoutes.js`

All routes protected with auth middleware:

- `GET /api/schedules`
- `POST /api/schedules`
- `PUT /api/schedules/:id`
- `DELETE /api/schedules/:id`

## Frontend File Explanation

### `frontend/server.js`

- Simple Express server for frontend pages.
- Serves static assets from `frontend/public`.
- Routes:
  - `/` -> `login.html`
  - `/dashboard` -> `dashboard.html`

### `frontend/views/login.html`

- Login/Register UI.
- Calls backend user APIs.
- Uses `credentials: 'include'` to send/receive cookie.
- Checks active session with `/api/users/me` on load.

### `frontend/views/dashboard.html`

- Dashboard layout.
- Schedule form and schedule table.
- Loads `public/js/dashboard.js`.

### `frontend/public/js/dashboard.js`

- Loads logged-in user.
- Redirects to login if unauthorized.
- CRUD operations for schedules.
- Logout support.

### `frontend/public/css/style.css`

- Basic styling for auth and dashboard pages.

## Authentication Flow (Cookie-Based)

1. User logs in via `/api/users/login`.
2. Backend sets cookie `token` (HTTP-only).
3. Browser sends cookie automatically on future API calls (`credentials: 'include'`).
4. Protected routes validate cookie in middleware.
5. Logout clears `token` cookie.

## CORS Logic

Because frontend and backend run on different ports, CORS is enabled in backend.

Current behavior:

- Handles preflight `OPTIONS` requests.
- Allows credentialed requests.
- Returns the requesting origin (not wildcard `*`) for browser compatibility with cookies.

This is required because cookie-based requests with `credentials: 'include'` do not work with `Access-Control-Allow-Origin: *`.

## API Endpoints

### User APIs

- `POST /api/users/register`
- `POST /api/users/login`
- `POST /api/users/logout`
- `GET /api/users/me` (protected)

### Schedule APIs (protected)

- `GET /api/schedules`
- `POST /api/schedules`
- `PUT /api/schedules/:id`
- `DELETE /api/schedules/:id`

## How To Run

1. Install dependencies:

```bash
npm install
```

2. Start backend terminal:

```bash
npm run start:backend
```

3. Start frontend terminal:

```bash
npm run start:frontend
```

4. Open app:

```text
http://localhost:3000
```

## Development Commands

```bash
npm run dev:backend
npm run dev:frontend
```

## Hardcoded Config Locations

- Backend port: `backend/server.js`
- MongoDB URL: `backend/config/db.js`
- JWT secret: `backend/utils/jwt.js`
- Frontend API base URL: `frontend/views/login.html`, `frontend/public/js/dashboard.js`
- Frontend server port: `frontend/server.js`
