import express from 'express';
import { protect } from '../middleware/auth.js';
import { logCall, updateCallState, getLeadCallHistory, getAllCallLogs, getCallAudio } from '../controllers/callController.js';
import { triggerAIAnalysis, getCallTranscript, getCallAIAnalysis } from '../controllers/aiAnalysisController.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getAllCallLogs)
  .post(logCall);

router.put('/:id', updateCallState);
router.get('/lead/:leadId', getLeadCallHistory);
router.get('/:id/audio', getCallAudio);

// AI Call Intelligence Endpoints
router.post('/:id/analyze', triggerAIAnalysis);
router.get('/:id/transcript', getCallTranscript);
router.get('/:id/analysis', getCallAIAnalysis);

export default router;
