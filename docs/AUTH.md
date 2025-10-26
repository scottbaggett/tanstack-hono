# Authentication Guide

## Overview

The workflow builder includes JWT-based authentication with password hashing using bcrypt.

**Public endpoints:**
- `POST /api/auth/register` - Create new user
- `POST /api/auth/login` - Authenticate user

**Protected endpoints:**
- `GET /api/auth/me` - Get current user (requires token)
- `GET /api/workflows` - All workflow endpoints require authentication

## Configuration

Environment variables:
```bash
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRY=7d
```

If not set, defaults to:
- `JWT_SECRET`: "your-secret-key-change-in-production"
- `JWT_EXPIRY`: "7d"

⚠️ **Important**: Set `JWT_SECRET` to a strong random value in production!

## API Endpoints

### Register User

**Endpoint:**
```
POST /api/auth/register
```

**Request:**
```json
{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "SecurePassword123",
  "fullName": "John Doe"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "username": "johndoe",
      "fullName": "John Doe"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Validation:**
- Email must be valid and unique
- Username must be 3-100 characters
- Password must be at least 8 characters
- Full name is optional (max 255 chars)

### Login User

**Endpoint:**
```
POST /api/auth/login
```

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "username": "johndoe",
      "fullName": "John Doe"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Errors:**
- `401 Unauthorized` - Invalid email or password
- `401 Unauthorized` - User account is inactive

### Get Current User

**Endpoint:**
```
GET /api/auth/me
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "johndoe",
    "fullName": "John Doe",
    "isActive": true,
    "createdAt": "2025-10-26T00:00:00Z"
  }
}
```

**Errors:**
- `401 Unauthorized` - Missing or invalid token
- `404 Not Found` - User not found

## Using the Token

All protected endpoints require the JWT token in the `Authorization` header:

```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/workflows
```

## Under the Hood

### Password Hashing

Passwords are hashed using bcryptjs with 10 rounds:
- Never stored in plain text
- Cannot be reversed
- Each hash is unique even for the same password

### JWT Token

Tokens contain:
- `userId` - User's UUID
- `email` - User's email
- `username` - User's username
- `iat` - Issued at timestamp
- `exp` - Expiration timestamp

Token lifetime is configurable via `JWT_EXPIRY` (default: 7 days).

### Protected Routes

Workflow endpoints are protected with the `authMiddleware`:
- Extracts token from `Authorization` header
- Verifies token signature and expiration
- Adds user info to request context
- Returns 401 if authentication fails

## Examples

### Register and Login

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "username": "alice",
    "password": "MySecurePass123",
    "fullName": "Alice Smith"
  }'

# Response includes token
# {
#   "success": true,
#   "data": {
#     "user": {...},
#     "token": "eyJh..."
#   }
# }
```

### Use Token to Access Protected Route

```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Get current user
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/auth/me

# List workflows (protected)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/workflows
```

### Refresh Token

There's no refresh endpoint yet. When a token expires, the user must log in again.

To implement token refresh:
1. Create a separate "refresh token" stored in database
2. Use refresh token to get new access token
3. Keep access token lifetime short (1 hour)
4. Keep refresh token lifetime long (30 days)

## Security Considerations

### In Development

Default `JWT_SECRET` is unsafe. The system will work but is not production-ready.

### For Production

1. **Set JWT_SECRET to a strong random value** (minimum 32 characters)
   ```bash
   export JWT_SECRET=$(openssl rand -base64 32)
   ```

2. **Use HTTPS** - Never send tokens over HTTP

3. **Token storage** - Store token in secure, httpOnly cookie or localStorage

4. **Rate limiting** - Add rate limiting on auth endpoints to prevent brute force

5. **Password policy** - Consider enforcing stronger password requirements

6. **2FA** - Consider adding two-factor authentication for sensitive accounts

7. **Token expiration** - Keep `JWT_EXPIRY` relatively short (e.g., 1 hour)

8. **Refresh tokens** - Implement refresh token flow for better security

## See Also

- [API.md](./API.md) - Complete API reference
- [DEVELOPMENT.md](./DEVELOPMENT.md) - Development setup
