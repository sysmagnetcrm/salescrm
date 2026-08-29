import express from 'express';
import { getDispositions, createDisposition } from '../controllers/dispositionController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router
  .route('/')
  .get(getDispositions)
  .post(authorize('admin'), createDisposition);

export default router;
