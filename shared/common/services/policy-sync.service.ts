import { Injectable, Logger } from '@nestjs/common';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { RolePolicyDocument } from '../types/policy.types';

@Injectable()
export class PolicySyncService {
    private readonly logger = new Logger(PolicySyncService.name);
    private readonly docClient: DynamoDBDocumentClient;
    private readonly tableName: string;

    constructor() {
        const client = new DynamoDBClient({
            region: process.env.AWS_REGION_NAME || 'us-east-1'
        });
        this.docClient = DynamoDBDocumentClient.from(client);
        this.tableName = process.env.ROLE_POLICIES_TABLE_NAME || 'role-policies';
    }

    /**
     * Syncs a role policy to DynamoDB
     */
    async syncRolePolicy(policyDoc: RolePolicyDocument): Promise<void> {
        try {
            const item = {
                PK: `ROLE#${policyDoc.roleName}`,
                SK: 'POLICY',
                roleName: policyDoc.roleName,
                policy: policyDoc.policy,
                isActive: policyDoc.isActive,
                updatedAt: new Date().toISOString(),
            };

            // Add tenant information if present
            if (policyDoc.tenantId) {
                Object.assign(item, {
                    tenantId: policyDoc.tenantId,
                    GSI1PK: `TENANT#${policyDoc.tenantId}`,
                    GSI1SK: `ROLE#${policyDoc.roleName}`,
                });
            }

            const command = new PutCommand({
                TableName: this.tableName,
                Item: item,
            });

            await this.docClient.send(command);

            this.logger.log(`Successfully synced policy for role: ${policyDoc.roleName}`);
        } catch (error) {
            this.logger.error(`Failed to sync policy for role ${policyDoc.roleName}:`, error);
            throw error;
        }
    }

    /**
     * Deletes a role policy from DynamoDB
     */
    async deleteRolePolicy(roleName: string): Promise<void> {
        try {
            const command = new DeleteCommand({
                TableName: this.tableName,
                Key: {
                    PK: `ROLE#${roleName}`,
                    SK: 'POLICY',
                },
            });

            await this.docClient.send(command);

            this.logger.log(`Successfully deleted policy for role: ${roleName}`);
        } catch (error) {
            this.logger.error(`Failed to delete policy for role ${roleName}:`, error);
            throw error;
        }
    }

    /**
     * Batch sync multiple policies
     */
    async batchSyncPolicies(policies: RolePolicyDocument[]): Promise<void> {
        const results = await Promise.allSettled(
            policies.map(policy => this.syncRolePolicy(policy))
        );

        const failed = results.filter(r => r.status === 'rejected');

        if (failed.length > 0) {
            this.logger.warn(`${failed.length} policies failed to sync out of ${policies.length}`);
        } else {
            this.logger.log(`Successfully synced ${policies.length} policies`);
        }
    }
}
