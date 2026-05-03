import express, { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import { abacMiddleware } from '../middleware/abac';
import * as courseController from '../controllers/courseController';
import * as materialController from '../controllers/materialController';
import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req: any, file: any, cb: any) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

const router = Router();

// Get all materials (admin only, must be before specific routes)
router.get('/', authMiddleware, adminMiddleware, materialController.getAllMaterials);

// Get documentation (must be before /:id route)
router.get('/documentation', authMiddleware, materialController.getDocumentation);

// Скачивание / просмотр вложения (до /:id, иначе «files» воспринимается как id)
router.get(
  '/files/:fileId/download',
  authMiddleware,
  materialController.downloadMaterialFile
);

// Get materials by course (with ABAC protection)
router.get('/:id', authMiddleware, abacMiddleware, courseController.getMaterialById);
router.post('/:id/unlock', authMiddleware, materialController.unlockMaterial);
router.post('/:id/complete', authMiddleware, materialController.markAsCompleted);

// Admin routes
router.post('/', authMiddleware, adminMiddleware, materialController.createMaterial);
router.put('/:id', authMiddleware, adminMiddleware, materialController.updateMaterial);
router.delete('/:id', authMiddleware, adminMiddleware, materialController.deleteMaterial);

// Material roles
router.post('/role/add', authMiddleware, adminMiddleware, materialController.addRoleToMaterial);
router.delete('/:materialId/role/:roleId', authMiddleware, adminMiddleware, materialController.removeRoleFromMaterial);

// Material users
router.post('/user/add', authMiddleware, adminMiddleware, materialController.addUserToMaterial);
router.delete('/:materialId/user/:userId', authMiddleware, adminMiddleware, materialController.removeUserFromMaterial);

// File upload
router.post('/upload', authMiddleware, adminMiddleware, upload.single('file'), materialController.uploadFile);
router.delete('/file/:id', authMiddleware, adminMiddleware, materialController.deleteFile);

// Image upload (for rich text editor, no materialId required)
router.post('/upload-image', authMiddleware, adminMiddleware, upload.single('image'), materialController.uploadImage);

export default router;
