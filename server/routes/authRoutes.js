import express from 'express';
import { register, login, loginByPhone, getMe, changePassword, updateProfile } from '../controllers/authController.js';
import { protect, authorize } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/register', protect, authorize('admin'), register);
router.post('/login', authRateLimiter, login);
router.post('/login-phone', authRateLimiter, loginByPhone);
router.get('/me', protect, getMe);
router.put('/password', protect, changePassword);
router.put('/profile', protect, updateProfile);

export default router;


