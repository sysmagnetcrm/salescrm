import express from 'express';
import {
  getSalespeople,
  createSalesperson,
  updateSalesperson,
  deactivateSalesperson,
  getSalespersonPerformance,
  getDetailedPerformance
} from '../controllers/userController.js';
import { protect, authorize } from '../middleware/auth.js';
import { enforceBranchAccess, authorizeUserAccess } from '../middleware/authorizeBranch.js';

const router = express.Router();

router.use(protect);
router.use(enforceBranchAccess);

router
  .route('/salespeople')
  .get(authorize('admin', 'accountant'), getSalespeople)
  .post(authorize('admin', 'accountant'), createSalesperson);

router
  .route('/salespeople/:id')
  .put(authorize('admin', 'accountant'), updateSalesperson)
  .delete(authorize('admin', 'accountant'), deactivateSalesperson);

router.get('/salespeople/:id/performance', authorizeUserAccess, getSalespersonPerformance);
router.get('/salespeople/:id/performance-detailed', authorize('admin', 'accountant'), authorizeUserAccess, getDetailedPerformance);

export default router;

