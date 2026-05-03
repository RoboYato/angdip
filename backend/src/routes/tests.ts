import express, { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import * as testController from '../controllers/testController';

const router = Router();

// Get all tests (admin)
router.get('/', authMiddleware, adminMiddleware, testController.getAllTests);

// Get tests by course (any auth user)
router.get('/course/:courseId', authMiddleware, testController.getTestsByCourse);

// Get test with questions & answers (any auth user)
router.get('/:testId', authMiddleware, testController.getTestWithQuestions);

// Admin routes
router.post('/', authMiddleware, adminMiddleware, testController.createTest);
router.delete('/:testId', authMiddleware, adminMiddleware, testController.deleteTest);
router.post('/question/add', authMiddleware, adminMiddleware, testController.addQuestionToTest);
router.delete('/question/:questionId', authMiddleware, adminMiddleware, testController.deleteQuestion);
router.post('/answer/add', authMiddleware, adminMiddleware, testController.addAnswerToQuestion);

// User routes
router.post('/submit', authMiddleware, testController.submitTestAnswers);
router.get('/:testId/results', authMiddleware, testController.getTestResults);

export default router;
