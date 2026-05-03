import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as notificationsController from '../controllers/notificationsController';

const router = Router();

router.get('/', authMiddleware, notificationsController.getMyNotifications);
router.get('/unread-count', authMiddleware, notificationsController.getUnreadCount);
router.patch('/:id/read', authMiddleware, notificationsController.markNotificationRead);

export default router;
