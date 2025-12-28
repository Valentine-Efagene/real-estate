# Lambda Runtime Dependencies for NestJS API

This document tracks the required runtime dependencies for deploying a NestJS API to AWS Lambda.

## Core Framework Dependencies

These are the essential packages that must be included in the Lambda deployment package:

### NestJS Framework

- **@nestjs/common** - Core NestJS decorators, pipes, guards, etc.
- **@nestjs/core** - NestJS application core functionality
- **@nestjs/platform-express** - Express adapter for NestJS
- **@nestjs/jwt** - JWT utilities
- **@nestjs/passport** - Passport integration
- **@nestjs/swagger** - OpenAPI/Swagger integration
- **@nestjs/throttler** - Rate limiting
- **@nestjs/typeorm** - TypeORM integration

### Database & ORM

- **typeorm** - TypeORM library
- **mysql2** - MySQL database driver

### Validation & Transformation

- **class-validator** - Decorator-based validation
- **class-transformer** - Class transformation utilities

### Utilities & Core Dependencies

- **reflect-metadata** - Metadata reflection API (required by TypeORM and NestJS decorators)
- **rxjs** - Reactive extensions library (required by NestJS)
- **tslib** - TypeScript runtime library

### Custom Packages

- **@valentine-efagene/qshelter-common** - Shared common utilities and entities

## Additional Runtime Dependencies

These are dependencies required by the core packages above:

### NestJS Internal Dependencies

- **uid** (68K) - Unique ID generation (required by @nestjs/common decorators)
- **iterare** (280K) - Iterator utilities (required by @nestjs/common pipes)
- **fast-safe-stringify** (68K) - Fast JSON stringification (required by @nestjs/core injector)

## Package Sizes

Analysis of runtime dependencies included in Lambda deployment:

| Package                            | Size     | Notes                                          |
| ---------------------------------- | -------- | ---------------------------------------------- |
| @nestjs                            | 38M      | Core framework - cannot be reduced             |
| typeorm                            | 31M      | ORM library - required for database operations |
| rxjs                               | 11M      | Reactive extensions - required by NestJS       |
| class-validator                    | 7.5M     | Validation decorators - heavily used           |
| @valentine-efagene/qshelter-common | 2.6M     | Custom shared library                          |
| class-transformer                  | 1.5M     | Class transformation - required by NestJS      |
| mysql2                             | 1.2M     | MySQL driver - required for database           |
| reflect-metadata                   | 264K     | Metadata API - required by decorators          |
| iterare                            | 280K     | Iterator utilities                             |
| tslib                              | 124K     | TypeScript runtime                             |
| uid                                | 68K      | ID generation                                  |
| fast-safe-stringify                | 68K      | JSON stringification                           |
| **Total**                          | **~93M** | Well under 262MB Lambda limit                  |

## Deployment Strategy

### Webpack Configuration

- **Mode**: Production (enables minification and tree-shaking)
- **Minification**: Enabled with Terser (drops console logs, mangles variable names)
- **Externals**: Only core framework packages and their dependencies are kept external
- **Bundle size**: ~84 KB (minimized)

### Package Patterns (serverless.yml)

1. Exclude all node_modules by default: `!node_modules/**`
2. Explicitly include only required runtime dependencies
3. Total package size: ~15 MB (unzipped)
4. Lambda limit: 262 MB (unzipped)

## Package Size Optimization

| Strategy                        | Result                                           |
| ------------------------------- | ------------------------------------------------ |
| Include all node_modules        | 136+ MB (failed - exceeded limit)                |
| Whitelist specific packages     | Missing transitive dependencies (runtime errors) |
| Blacklist with webpack bundling | 15 MB ✅ (current approach)                      |

## Excluded Packages (Available in Lambda Runtime)

### AWS SDK

- **@aws-sdk/** - AWS SDK v3 is already available in the Lambda Node.js runtime, so it's excluded from the deployment package

## Notes

- Most application code is bundled into the webpack bundle (`dist-webpack/serverless.js`)
- Only packages that cannot be bundled (native modules, framework packages with dynamic requires) are included from node_modules
- AWS SDK v3 is excluded because it's already available in the Lambda runtime environment
- As new runtime errors occur, add the missing packages to the serverless.yml patterns
- Keep this list updated as dependencies are discovered during deployment testing
