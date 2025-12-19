import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { RolePolicyItem } from './types';

const client = new DynamoDBClient({ region: process.env.AWS_REGION_NAME || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

export class PolicyRepository {
    private tableName: string;

    constructor() {
        this.tableName = process.env.ROLE_POLICIES_TABLE_NAME || 'role-policies';
    }

    async getPoliciesForRoles(roles: string[]): Promise<RolePolicyItem[]> {
        const policies: RolePolicyItem[] = [];

        for (const role of roles) {
            try {
                const command = new QueryCommand({
                    TableName: this.tableName,
                    KeyConditionExpression: 'PK = :pk AND SK = :sk',
                    ExpressionAttributeValues: {
                        ':pk': `ROLE#${role}`,
                        ':sk': 'POLICY',
                    },
                });

                const response = await docClient.send(command);

                if (response.Items && response.Items.length > 0) {
                    const item = response.Items[0] as RolePolicyItem;
                    if (item.isActive) {
                        policies.push(item);
                    }
                }
            } catch (error) {
                console.error(`Error fetching policy for role ${role}:`, error);
                // Continue with other roles even if one fails
            }
        }

        return policies;
    }

    async getPolicyByRoleAndTenant(role: string, tenantId: string): Promise<RolePolicyItem | null> {
        try {
            const command = new QueryCommand({
                TableName: this.tableName,
                IndexName: 'GSI1',
                KeyConditionExpression: 'GSI1PK = :gsi1pk AND GSI1SK = :gsi1sk',
                ExpressionAttributeValues: {
                    ':gsi1pk': `TENANT#${tenantId}`,
                    ':gsi1sk': `ROLE#${role}`,
                },
            });

            const response = await docClient.send(command);

            if (response.Items && response.Items.length > 0) {
                const item = response.Items[0] as RolePolicyItem;
                return item.isActive ? item : null;
            }

            return null;
        } catch (error) {
            console.error(`Error fetching policy for role ${role} and tenant ${tenantId}:`, error);
            return null;
        }
    }
}
