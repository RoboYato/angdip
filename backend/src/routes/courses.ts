import express, { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import * as courseController from '../controllers/courseController';
import * as adminCourseController from '../controllers/adminCourseController';

const router = Router();

// User routes (более специфичный маршрут /:courseId/modules — перед /:id)
router.get('/', authMiddleware, courseController.getCourses);
router.get('/:courseId/modules', authMiddleware, courseController.getCourseModules);
router.get('/:id', authMiddleware, courseController.getCourseById);
router.post('/:courseId/enroll', authMiddleware, courseController.enrollInCourse);

// Admin routes
router.post('/', authMiddleware, adminMiddleware, adminCourseController.createCourse);
router.put('/:id', authMiddleware, adminMiddleware, adminCourseController.updateCourse);
router.delete('/:id', authMiddleware, adminMiddleware, adminCourseController.deleteCourse);

// Course roles
router.post('/role/add', authMiddleware, adminMiddleware, adminCourseController.addRoleToCourse);
router.delete('/:courseId/role/:roleId', authMiddleware, adminMiddleware, adminCourseController.removeRoleFromCourse);

// Course users
router.post('/user/add', authMiddleware, adminMiddleware, adminCourseController.addUserToCourse);
router.delete('/:courseId/user/:userId', authMiddleware, adminMiddleware, adminCourseController.removeUserFromCourse);

export default router;
