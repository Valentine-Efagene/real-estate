# Google OAuth2 Authentication Flow

This service supports **two Google authentication methods**:

## 1. Client-Side Token Flow (Existing)

For SPAs using libraries like `@react-oauth/google`.

### Flow:

1. Frontend initiates Google sign-in and gets ID token
2. Frontend sends token to `POST /api/auth/google-token-login`
3. Backend verifies token and returns JWT tokens

### Usage:

```javascript
// Frontend code
const { credential } = await googleLogin();
const response = await fetch("/api/auth/google-token-login", {
  method: "POST",
  body: JSON.stringify({ token: credential }),
  headers: { "Content-Type": "application/json" },
});
const { accessToken, refreshToken } = await response.json();
```

## 2. Server-Side OAuth2 Redirect Flow (New)

Traditional OAuth2 flow with redirects.

### Flow:

1. User clicks "Sign in with Google" button
2. User is redirected to `GET /api/auth/google`
3. Backend redirects to Google's consent screen
4. User authorizes and Google redirects to `GET /api/auth/google/callback?code=...&state=...`
5. Backend exchanges code for tokens, verifies user, and redirects to frontend with JWT tokens

### Usage:

```html
<!-- Frontend code -->
<a href="/api/auth/google">Sign in with Google</a>
```

Frontend callback handler:

```javascript
// Handle callback at /auth/callback
const params = new URLSearchParams(window.location.search);
const accessToken = params.get("accessToken");
const refreshToken = params.get("refreshToken");

// Store tokens
localStorage.setItem("accessToken", accessToken);
localStorage.setItem("refreshToken", refreshToken);

// Redirect to dashboard
window.location.href = "/dashboard";
```

## Environment Variables Required

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=https://api.yourdomain.com/api/auth/google/callback
FRONTEND_BASE_URL=https://yourdomain.com
```

## Security Features

### CSRF Protection

The OAuth2 redirect flow uses state parameter for CSRF protection:

- Random state token generated and stored in database with 10-minute expiry
- State verified on callback before processing authorization code
- Used state tokens are immediately deleted

### Auto-Registration

New users signing in with Google are automatically registered with:

- Email verified (Google accounts are pre-verified)
- Random password generated and hashed
- Account activated immediately
- Google ID stored for future logins

## Database Migration

After adding the OAuth flow, regenerate Prisma client:

```bash
cd shared/common
pnpm prisma generate
```

The new `OAuthState` model stores temporary state tokens for CSRF protection.
