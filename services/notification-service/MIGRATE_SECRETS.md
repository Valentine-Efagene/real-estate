# Migrating notifications service environment variables to SSM / Secrets Manager

This document describes how to move local `.env.test` values into AWS Parameter Store (SSM) and Secrets Manager so production Lambda deployments can load them securely.

Principles

- Non-sensitive configuration (URLs, ARNs) -> SSM Parameter Store (String)
- Sensitive secrets (passwords, client secrets, AWS keys) -> SSM SecureString or Secrets Manager
- Use parameter path: `/qshelter/<service>/<stage>/<KEY>` or `/qshelter/<stage>/KEY` depending on preference
- Serverless config expects parameters at `/qshelter/${self:provider.stage}/<KEY>`

Example variable mapping (from `.env.test`):

- SMTP_USERNAME -> SSM SecureString `/qshelter/test/SMTP_USERNAME`
- SMTP_PASSWORD -> SSM SecureString `/qshelter/test/SMTP_PASSWORD`
- OFFICE365_CLIENT_SECRET -> SSM SecureString `/qshelter/test/OFFICE365_CLIENT_SECRET`
- AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY -> SSM SecureString `/qshelter/test/AWS_ACCESS_KEY_ID`, `/qshelter/test/AWS_SECRET_ACCESS_KEY`
- SQS_URL, PLATFORM_APPLICATION_ARN, OFFICE365_CLIENT_ID, OFFICE365_TENANT_ID, OFFICE365_SENDER_EMAIL, SMTP_HOST, SMTP_PORT, SMTP_ENCRYPTION -> SSM String

CLI commands (replace `<stage>` with `prod`/`staging` as needed)

# 1. Create SSM String parameters

aws ssm put-parameter --name "/qshelter/test/SQS_URL" --type String --value "https://sqs.us-east-1.amazonaws.com/532226472801/qshel_email_que"

aws ssm put-parameter --name "/qshelter/test/PLATFORM_APPLICATION_ARN" --type String --value "arn:aws:sns:us-east-1:898751738669:app/GCM/qshelter_notification"

aws ssm put-parameter --name "/qshelter/test/OFFICE365_CLIENT_ID" --type String --value "7aeae91d-c6d3-4108-8d83-854834b7a51d"

aws ssm put-parameter --name "/qshelter/test/OFFICE365_TENANT_ID" --type String --value "42776b2d-b795-4329-b145-e5d100bbece6"

aws ssm put-parameter --name "/qshelter/test/OFFICE365_SENDER_EMAIL" --type String --value "mreif@qshelter.ng"

aws ssm put-parameter --name "/qshelter/test/SMTP_HOST" --type String --value "smtp.mailtrap.io"
aws ssm put-parameter --name "/qshelter/test/SMTP_PORT" --type String --value "2525"
aws ssm put-parameter --name "/qshelter/test/SMTP_ENCRYPTION" --type String --value "STARTTLS"

# 2. Create SSM SecureString parameters for secrets

aws ssm put-parameter --name "/qshelter/test/SMTP_USERNAME" --type SecureString --value "ec27b9c33d0ca2"
aws ssm put-parameter --name "/qshelter/test/SMTP_PASSWORD" --type SecureString --value "08ea8bf2472cc5"

aws ssm put-parameter --name "/qshelter/test/OFFICE365_CLIENT_SECRET" --type SecureString --value "<OFFICE365_CLIENT_SECRET>"

aws ssm put-parameter --name "/qshelter/test/AWS_ACCESS_KEY_ID" --type SecureString --value "<AWS_ACCESS_KEY_ID>"
aws ssm put-parameter --name "/qshelter/test/AWS_SECRET_ACCESS_KEY" --type SecureString --value "<AWS_SECRET_ACCESS_KEY>"

# (Optional) Use Secrets Manager instead for richer lifecycle management

# Create a secret named "qshelter/test/notifications" containing a JSON object

aws secretsmanager create-secret --name "qshelter/test/notifications" --description "Notifications service secrets for test" --secret-string '{"SMTP_USERNAME":"ec27b9c33d0ca2","SMTP_PASSWORD":"08ea8bf2472cc5","OFFICE365_CLIENT_SECRET":"<OFFICE365_CLIENT_SECRET>","AWS_ACCESS_KEY_ID":"<AWS_ACCESS_KEY_ID>","AWS_SECRET_ACCESS_KEY":"<AWS_SECRET_ACCESS_KEY>"}'

# Serverless references

# - SSM SecureString: ${ssm:/qshelter/${self:provider.stage}/SMTP_PASSWORD~true}

# - Secrets Manager via SSM reference: ${ssm:/aws/reference/secretsmanager/qshelter/${self:provider.stage}/notifications~true}

Notes

- Ensure the Lambda IAM role has `ssm:GetParameter` and `secretsmanager:GetSecretValue` permissions. `serverless.yml` in this repo already declares those statements.
- For LocalStack/test deployments keep using `.env.test`. Only move real secrets to SSM/Secrets in AWS environments.
- Consider using KMS for additional encryption policy management for SSM SecureString (you can pass `--key-id` to `put-parameter`).

Rollback / cleanup

- To remove a parameter: `aws ssm delete-parameter --name "/qshelter/test/SMTP_PASSWORD"`
- To remove a secret: `aws secretsmanager delete-secret --secret-id "qshelter/test/notifications" --recovery-window-in-days 7`

Security reminder

- Never commit secrets to git. Use AWS IAM and Secrets Manager policies and CI/CD secrets to populate these values when deploying.

Contact

- If you want, I can also add a small script to automate uploading `.env.test` values into SSM for a given stage.
