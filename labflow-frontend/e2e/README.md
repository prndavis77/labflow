# Frontend End-to-End Tests

Labfluss uses Playwright for browser-based end-to-end testing.

The E2E suite is intended for an isolated development or CI environment. It must not be run against production data or production storage.

## Current coverage

The baseline suite covers:

- successful login with a seeded admin
- invalid login handling
- unauthenticated protected-route redirect
- authenticated Projects access
- authenticated Tasks access
- attachment upload, download, and archive
- backend-driven session invalidation and forced reauthentication

## Requirements

Before running the tests:

1. Install frontend dependencies.
2. Install the Playwright Chromium browser.
3. Start the Labfluss backend on the expected API URL.
4. Use an isolated development database with the demo seed data.
5. Configure the development attachment storage provider.
6. Set the required E2E credentials as environment variables.

The attachment tests must use development storage, such as the isolated Labfluss development S3 bucket. Do not point the E2E suite at the production attachment bucket.

## Required environment variables

The test suite expects:

- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`
- `E2E_SESSION_USER_EMAIL`
- `E2E_SESSION_USER_PASSWORD`

Optional:

- `E2E_API_URL`

If `E2E_API_URL` is not set, the session-invalidation test uses:

`http://localhost:5000/api`

Credentials must not be committed to the repository.

## Installation

From `labflow-frontend`:

```powershell
npm install
```
