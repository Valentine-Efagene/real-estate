<p align="center">
  <a href="https://www.quickshelter.ng/" target="blank"><img src="https://www.quickshelter.ng/quickshelter.svg" width="200" alt="QShelter Logo" /></a>
</p>

# Notifications Service

## Description

Notifications Service

## Stack

- NestJS
- TypeORM
- MySQL
- AWS Lambda
- AWS SES
- AWS SQS
- Serverless

## Installation

```bash
$ pnpm install
```

## Running the app

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Process Flow for New Email Creation 
1. Create email template html file in the appropriate location under src/email/templates
2. In TemplateType enum, create the enum entry for the template
3. In DataHelper, set the appropriate path for each email template, by matching template  
TemplateType to string path. Do same for template title.
4. Create an endpoint in email.controller.ts, and create a corresponding DTO for it in  
email.dto.ts. Make sure to set the right template name in the controller function
4. Call the endpoint to update all templates for the target application  
'/email/update-all-templates' in the API Swagger documentation
5. Test the email

## Process Flow to Update an Existing Template
1. Update email template html file in the appropriate location under src/email/templates
2. If the variables have changed, make sure to update them in the corresponding DTO
4. Call the endpoint to update all templates for the target application  
'/email/update-all-templates' in the API Swagger documentation
5. Test the email

## Note
Sometimes, update-all-templates returns 'rate limit' or 'internal server error', but still works after some time.

## Debugging
- On CloudWatch log groups or Live Tail, check if SES response has up to 2 retries.  
  this may point to a typo in variable names in the template.

## References
- [https://docs.nestjs.com/](NestJS)

## Stay in touch

- Author - QShelter
- Phone - 08182078758
- Email - [info@quickshelter.ng](mailto:info@quickshelter.ng)
- Website - [https://www.quickshelter.ng/](https://www.quickshelter.ng/)
- LinkedIn - [https://www.linkedin.com/company/q-shelter-ng](https://www.linkedin.com/company/q-shelter-ng)
