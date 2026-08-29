import express from 'express';
import { getSystemVersion } from '../controllers/systemController.js';

const router = express.Router();

router.get('/version', getSystemVersion);

export default router;
