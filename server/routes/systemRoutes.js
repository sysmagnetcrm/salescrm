import express from 'express';
import { getSystemVersion, exportReport, exportBackup, restoreDatabase } from '../controllers/systemController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.get('/version', getSystemVersion);
router.get('/export/report', protect, authorize('admin'), exportReport);
router.get('/export/backup', protect, authorize('admin'), exportBackup);
router.post('/restore', protect, authorize('admin'), restoreDatabase);

export default router;
