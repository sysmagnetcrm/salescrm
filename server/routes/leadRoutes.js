import express from 'express';
import {
  uploadLeads,
  getAllLeads,
  getMyLeads,
  getLeadQueue,
  getLead,
  updateLead,
  addActivity,
  deleteLead,
  getCountries,
  getProducts,
  getStaleLeads,
  redistributeLeads,
  createLead,
  assignLeads,
  getUnassignedLeads,
  markDuplicate
} from '../controllers/leadController.js';
import { protect, authorize } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { enforceBranchAccess, authorizeLeadAccess } from '../middleware/authorizeBranch.js';

const router = express.Router();

router.use(protect);
router.use(enforceBranchAccess);

router.post('/upload', authorize('admin', 'accountant'), upload.single('file'), uploadLeads);
router.post('/', authorize('admin', 'accountant', 'salesperson'), createLead);
router.get('/countries', getCountries);
router.get('/products', getProducts);
router.get('/stale', authorize('admin', 'accountant'), getStaleLeads);
router.get('/unassigned', authorize('admin', 'accountant'), getUnassignedLeads);
router.post('/redistribute', authorize('admin', 'accountant'), redistributeLeads);
router.post('/assign', authorize('admin', 'accountant'), assignLeads);
router.get('/', authorize('admin', 'accountant'), getAllLeads);
router.get('/my-leads', authorize('salesperson'), getMyLeads);
router.get('/queue', authorize('salesperson'), getLeadQueue);

router
  .route('/:id')
  .get(authorizeLeadAccess, getLead)
  .put(authorizeLeadAccess, updateLead)
  .delete(authorize('admin', 'accountant'), authorizeLeadAccess, deleteLead);

router.post('/:id/activity', authorizeLeadAccess, addActivity);
router.post('/:id/mark-duplicate', authorizeLeadAccess, markDuplicate);

export default router;
