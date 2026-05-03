import express, { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as reportController from '../controllers/reportController';

const router = Router();

router.get('/report/user/:userId', authMiddleware, reportController.getResponsibleUserReport);

export default router;
