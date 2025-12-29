import { Router, type Router as RouterType } from 'express';
import { successResponse } from '@valentine-efagene/qshelter-common';
import { prisma } from '../lib/prisma.js';
import {
  createMortgageSchema,
  updateMortgageSchema,
  createMortgageTypeSchema,
  createPaymentSchema,
  createDownpaymentSchema,
} from '../validators/mortgage.validator.js';
import {
  mortgageService,
  mortgageTypeService,
  paymentService,
  downpaymentService,
} from '../services/mortgage.service.js';

export const mortgageRouter: RouterType = Router();

// Minimal DB sanity route (uses Prisma from qshelter-common)
mortgageRouter.get('/db/ping', async (req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json(successResponse({ ok: true }));
  } catch (err) {
    next(err as Error);
  }
});

// Mortgages CRUD
mortgageRouter.post('/mortgages', async (req, res, next) => {
  try {
    const data = createMortgageSchema.parse(req.body);
    const mortgage = await mortgageService.createMortgage(data);
    res.status(201).json(successResponse(mortgage));
  } catch (error) {
    next(error);
  }
});

mortgageRouter.get('/mortgages', async (req, res, next) => {
  try {
    const mortgages = await mortgageService.getMortgages();
    res.json(successResponse(mortgages));
  } catch (error) {
    next(error);
  }
});

mortgageRouter.get('/mortgages/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const mortgage = await mortgageService.getMortgageById(id);
    res.json(successResponse(mortgage));
  } catch (error) {
    next(error);
  }
});

mortgageRouter.put('/mortgages/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = updateMortgageSchema.parse(req.body);
    // TODO: Extract userId from auth context/JWT
    const userId = (req as any).userId || 'temp-user-id';
    const mortgage = await mortgageService.updateMortgage(id, data, userId);
    res.json(successResponse(mortgage));
  } catch (error) {
    next(error);
  }
});

mortgageRouter.delete('/mortgages/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    // TODO: Extract userId from auth context/JWT
    const userId = (req as any).userId || 'temp-user-id';
    const result = await mortgageService.deleteMortgage(id, userId);
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

// Mortgage Types
mortgageRouter.post('/mortgage-types', async (req, res, next) => {
  try {
    const data = createMortgageTypeSchema.parse(req.body);
    const mortgageType = await mortgageTypeService.createMortgageType(data);
    res.status(201).json(successResponse(mortgageType));
  } catch (error) {
    next(error);
  }
});

mortgageRouter.get('/mortgage-types', async (req, res, next) => {
  try {
    const types = await mortgageTypeService.getMortgageTypes();
    res.json(successResponse(types));
  } catch (error) {
    next(error);
  }
});

// Downpayments
mortgageRouter.post('/downpayments', async (req, res, next) => {
  try {
    const data = createDownpaymentSchema.parse(req.body);
    const downpayment = await downpaymentService.createDownpayment(data);
    res.status(201).json(successResponse(downpayment));
  } catch (error) {
    next(error);
  }
});

mortgageRouter.get('/downpayments/:planId', async (req, res, next) => {
  try {
    const { planId } = req.params;
    const downpayments = await downpaymentService.getDownpaymentsByMortgage(planId);
    res.json(successResponse(downpayments));
  } catch (error) {
    next(error);
  }
});

// Payments
mortgageRouter.post('/payments', async (req, res, next) => {
  try {
    const data = createPaymentSchema.parse(req.body);
    const payment = await paymentService.createPayment(data);
    res.status(201).json(successResponse(payment));
  } catch (error) {
    next(error);
  }
});

mortgageRouter.get('/payments/:planId', async (req, res, next) => {
  try {
    const { planId } = req.params;
    const payments = await paymentService.getPaymentsByPlan(planId);
    res.json(successResponse(payments));
  } catch (error) {
    next(error);
  }
});

