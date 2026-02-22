export * from './error-handler';
export * from './request-logger';
export * from './tenant';
export * from './auth-context';
// configureAuth / setupAuth are exported via auth-context.
// Call setupAuth() at Lambda cold start to enable JWT verification.
