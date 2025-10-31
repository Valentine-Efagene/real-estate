<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="200" alt="Nest Logo" /></a>
</p>

## Description

This is a full-featured Real Estate Management API built with NestJS. It enables property owners, agents, and renters/buyers to manage property listings, amenities, media, documents, user authentication, permissions, and more. The API supports property search, booking, and management workflows for both rental and sale categories.

## Core Features

- User Registration & Authentication
  - Email/password sign-up and sign-in
  - Google OAuth2.0
- Role-based access (admin, agent, user)
- Email verification system
- Property Management
  - Create, update, and delete property listings
  - Add property metadata (title, address, city, country, price, category, type, amenities, media, documents)
  - Support for rental and sale categories
- Amenity Management
- Property Media & Document Uploads
- Search and filter properties
- Booking and inquiry workflows
- Multi-currency support (e.g. NGN, USD)
- Permissions and role-based access control

## Tech Stack

- Backend: NestJS (TypeORM, role/permission-based auth)
- Testing: Jest with Supertest
- Templating: Handlebars for dynamic HTML email rendering
- Data: MySQL
- Email Protocol: SMTP
- Cache store: Valkey
- Container Tool: Docker

## Installation

### Using Docker (Recommended)

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# Then start the development environment
docker-compose up
```

For detailed Docker setup instructions, see [DOCKER.md](./DOCKER.md).

### Manual Installation

```bash
$ pnpm install
```

## Running the app

### With Docker

```bash
# Development with hot reloading
make dev

# Production
make prod

# View logs
make logs

# Run tests
make test
```

### Manual

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Test

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

- Add a sample.jpg image in the `test/__fixtures__` folder

## Dev Errors

If you get the following error during Git push, check the sizes of the files  
you're pushing. It is usually related to having a file above 1MB, which is the  
default limit. You can set a new limit using

- git config --global http.postBuffer 524288000 # 500MB
- 524288000 is just file size in bytes
- I don't recommend it because it will simply bloat your diff, and this is
  just a simple REST API.

> git push origin main:main
> error: RPC failed; HTTP 400 curl 22 The requested URL returned error: 400
> send-pack: unexpected disconnect while reading sideband packet
> fatal: the remote end hung up unexpectedly
> Everything up-to-date

## Commands

- aws cloudformation create-stack --stack-name MySQLRDSStack --template-body file://mysql-rds-template.yaml --parameters ParameterKey=MasterUsername,ParameterValue=admin ParameterKey=MasterUserPassword,ParameterValue=YourPassword

## References

- Sample handlebars adapter: [Original Handlebars Adapter](https://github.com/nest-modules/mailer/blob/main/lib/adapters/handlebars.adapter.ts).
- Sample [Project](https://github.com/vishnucprasad/nest_auth/tree/main)
- [Mailer Tutorial](https://notiz.dev/blog/send-emails-with-nestjs)

## Stay in touch

- Author - Valentine Efagene
- Phone - 09034360573
- Email - [efagenevalentine@gmail.com](mailto:efagenevalentine@gmail.com)
- LinkedIn - [https://www.linkedin.com/in/valentine-efagene/](https://www.linkedin.com/in/valentine-efagene/)
