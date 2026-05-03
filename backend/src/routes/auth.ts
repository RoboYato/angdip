import express, { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as authController from '../controllers/authController';

const router = Router();

router.get('/roles', authController.getRolesForRegistration);
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/profile', authMiddleware, authController.getProfile);

export default router;
