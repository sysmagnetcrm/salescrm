import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { uploadBranding } from '../middleware/brandingUpload.js';
import {
    getCountries,
    addCountry,
    deleteCountry,
    getProducts,
    addProduct,
    deleteProduct,
    getStatuses,
    addStatus,
    deleteStatus,
    getPublicBranding,
    getBranding,
    updateBranding,
    uploadBrandingLogo,
    uploadBrandingFavicon,
    removeBrandingLogo,
    removeBrandingFavicon,
    resetBranding,
    getTelephonySettings
} from '../controllers/settingsController.js';

const router = express.Router();

// Admin Telephony Settings
router.get('/telephony', protect, authorize('admin'), getTelephonySettings);

// Public branding endpoint (for Login screen before auth)
router.get('/branding/public', getPublicBranding);

// Authenticated branding endpoints
router.route('/branding')
    .get(protect, getBranding)
    .put(protect, authorize('admin'), updateBranding);

router.post('/branding/logo', protect, authorize('admin'), uploadBranding.single('logo'), uploadBrandingLogo);
router.delete('/branding/logo', protect, authorize('admin'), removeBrandingLogo);

router.post('/branding/favicon', protect, authorize('admin'), uploadBranding.single('favicon'), uploadBrandingFavicon);
router.delete('/branding/favicon', protect, authorize('admin'), removeBrandingFavicon);

router.post('/branding/reset', protect, authorize('admin'), resetBranding);

// Master list endpoints
router.route('/statuses')
    .get(protect, getStatuses)
    .post(protect, authorize('admin', 'accountant'), addStatus);

router.route('/statuses/:id')
    .delete(protect, authorize('admin', 'accountant'), deleteStatus);

router.route('/countries')
    .get(protect, getCountries)
    .post(protect, authorize('admin', 'accountant'), addCountry);

router.route('/countries/:id')
    .delete(protect, authorize('admin', 'accountant'), deleteCountry);

router.route('/products')
    .get(protect, getProducts)
    .post(protect, authorize('admin', 'accountant'), addProduct);

router.route('/products/:id')
    .delete(protect, authorize('admin', 'accountant'), deleteProduct);

export default router;
