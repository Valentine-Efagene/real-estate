/**
 * Express Application for Policy Sync Service
 * 
 * Provides admin endpoints for:
 * - Health check
 * - Manual sync triggers
 * - Sync status
 */

import express, { Request, Response, NextFunction } from 'express';
import { successResponse, errorResponse } from '@valentine-efagene/qshelter-common';
import { getPolicySyncService } from './services/policy-sync.service';
import { getDynamoPolicyRepository } from './repositories/dynamo-policy.repository';

export const app = express();

app.use(express.json());

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
    res.json(successResponse({
        status: 'healthy',
        service: 'policy-sync-service',
        timestamp: new Date().toISOString(),
    }));
});

// Trigger full sync from RDS to DynamoDB
app.post('/sync/full', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const service = getPolicySyncService();
        await service.performFullSync();

        res.json(successResponse({
            message: 'Full sync completed successfully',
            timestamp: new Date().toISOString(),
        }));
    } catch (error) {
        next(error);
    }
});

// Sync a specific role by ID
app.post('/sync/role/:roleId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const roleId = req.params.roleId as string;
        const service = getPolicySyncService();
        await service.syncRole(roleId);

        res.json(successResponse({
            message: `Role ${roleId} synced successfully`,
            timestamp: new Date().toISOString(),
        }));
    } catch (error) {
        next(error);
    }
});

// Sync a specific role by name
app.post('/sync/role-by-name/:roleName', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const roleName = req.params.roleName as string;
        const service = getPolicySyncService();
        await service.syncRoleByName(roleName);

        res.json(successResponse({
            message: `Role "${roleName}" synced successfully`,
            timestamp: new Date().toISOString(),
        }));
    } catch (error) {
        next(error);
    }
});

// Get a role policy from DynamoDB (for debugging)
app.get('/policies/:roleName', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const roleName = req.params.roleName as string;
        const repo = getDynamoPolicyRepository();
        const policy = await repo.getRolePolicy(roleName);

        if (!policy) {
            return res.status(404).json(errorResponse('Policy not found'));
        }

        res.json(successResponse(policy));
    } catch (error) {
        next(error);
    }
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('[App] Error:', err);

    const statusCode = (err as any).statusCode || 500;
    res.status(statusCode).json(errorResponse(err.message || 'Internal server error'));
});

export default app;
