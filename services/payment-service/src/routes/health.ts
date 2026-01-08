import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

// =============================================================================
// Health Check Routes
// =============================================================================
// Standard health check endpoints for monitoring and load balancer
// =============================================================================

const router = Router();

/**
 * GET /health
 * Basic health check
 */
router.get('/', async (_req: Request, res: Response) => {
    return res.status(200).json({
        status: 'healthy',
        service: 'payment-service',
        timestamp: new Date().toISOString(),
    });
});

/**
 * GET /health/db
 * Database connectivity check
 */
router.get('/db', async (_req: Request, res: Response) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        return res.status(200).json({
            status: 'healthy',
            database: 'connected',
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        return res.status(503).json({
            status: 'unhealthy',
            database: 'disconnected',
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});

export default router;
