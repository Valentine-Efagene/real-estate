import 'dotenv/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const endpoint = process.env.DYNAMODB_ENDPOINT;

const client = new DynamoDBClient({
    region: process.env.AWS_REGION ?? 'us-east-1',
    ...(endpoint
        ? {
            endpoint,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'local',
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'local',
            },
        }
        : {}),
});

export const dynamodb = DynamoDBDocumentClient.from(client, {
    marshallOptions: {
        removeUndefinedValues: true,
    },
});

export const permissionsTableName =
    process.env.PERMISSIONS_TABLE ?? 'authorizer-api-dynamo-dev-permissions';
