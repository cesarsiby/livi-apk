export const ENV = {
  // Defaults to the real LIVI backend so a build that forgets to inject
  // EXPO_PUBLIC_API_BASE_URL (e.g. a profile in eas.json missing the `env`
  // block) still talks to production instead of silently failing against
  // localhost, which is unreachable from a real phone. For local
  // development against a backend running on your machine, set
  // EXPO_PUBLIC_API_BASE_URL in a local .env file (see .env.example).
  API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://livi-apk.onrender.com/api/v1',
  REQUEST_TIMEOUT_MS: 15000,
} as const;
