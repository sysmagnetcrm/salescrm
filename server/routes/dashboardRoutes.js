import express from 'express';
import {
  getAdminDashboard,
  getSalespersonDashboard,
  getLeaderboard,
  getStatusCounts
} from '../controllers/dashboardController.js';
import { protect, authorize } from '../middleware/auth.js';
import { enforceBranchAccess } from '../middleware/authorizeBranch.js';

const router = express.Router();

router.use(protect);
router.use(enforceBranchAccess);

router.get('/admin', authorize('admin', 'accountant'), getAdminDashboard);
router.get('/salesperson', authorize('salesperson'), getSalespersonDashboard);
router.get('/leaderboard', getLeaderboard);
router.get('/status-counts', authorize('admin', 'accountant'), getStatusCounts);

export default router;

