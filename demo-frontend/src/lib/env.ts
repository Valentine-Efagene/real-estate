/**
 * Environment configuration with type safety
 * All environment variables are accessed through this module
 */

export const env = {
  // Service URLs
  userServiceUrl: process.env.NEXT_PUBLIC_USER_SERVICE_URL!,
  propertyServiceUrl: process.env.NEXT_PUBLIC_PROPERTY_SERVICE_URL!,
  mortgageServiceUrl: process.env.NEXT_PUBLIC_MORTGAGE_SERVICE_URL!,
  documentsServiceUrl: process.env.NEXT_PUBLIC_DOCUMENTS_SERVICE_URL!,
  paymentServiceUrl: process.env.NEXT_PUBLIC_PAYMENT_SERVICE_URL!,
  notificationServiceUrl: process.env.NEXT_PUBLIC_NOTIFICATION_SERVICE_URL!,
  uploaderServiceUrl: process.env.NEXT_PUBLIC_UPLOADER_SERVICE_URL!,

  // App config
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'QShelter Demo',
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',

  // Cookie config (server-side only)
  cookieName: process.env.COOKIE_NAME || 'qshelter_session',
  cookieMaxAge: parseInt(process.env.COOKIE_MAX_AGE || '604800', 10), // 7 days
} as const;

// Validate required env vars at build time
const requiredEnvVars = [
  'NEXT_PUBLIC_USER_SERVICE_URL',
  'NEXT_PUBLIC_PROPERTY_SERVICE_URL',
  'NEXT_PUBLIC_MORTGAGE_SERVICE_URL',
] as const;

export function validateEnv() {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.warn(`Missing environment variables: ${missing.join(', ')}`);
  }
}
