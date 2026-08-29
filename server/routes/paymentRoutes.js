import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { recordPayment, getLeadPayments, allocateBatch } from '../controllers/paymentController.js';

const router = express.Router();

router.post('/', protect, recordPayment);
router.get('/lead/:leadId', protect, getLeadPayments);
router.post('/allocate-batch', protect, authorize('admin', 'accountant'), allocateBatch);

export default router;
