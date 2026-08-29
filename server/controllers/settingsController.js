import { Country, Product, Status, Lead, AppBranding, Activity } from '../models/index.js';

// --- Helper: Seed Default Statuses ---
const seedDefaultStatuses = async () => {
    const count = await Status.count();
    if (count === 0) {
        const defaults = [
            { label: 'Fresh', value: 'fresh', color: 'gray', order: 1 },
            { label: 'Follow-up', value: 'follow-up', color: 'orange', order: 2 },
            { label: 'RNR', value: 'rnr', color: 'purple', order: 3 },
            { label: 'Interested', value: 'interested', color: 'blue', order: 4 },
            { label: 'Registered', value: 'registered', color: 'green', order: 5 },
            { label: 'Dead', value: 'dead', color: 'red', order: 6 },
            { label: 'Cancelled', value: 'cancelled', color: 'red', order: 7 },
            { label: 'Rejected', value: 'rejected', color: 'red', order: 8 }
        ];
        await Status.bulkCreate(defaults);
        console.log('seeded default statuses');
    }
};

// @desc    Get all statuses
// @route   GET /api/settings/statuses
// @access  Private
export const getStatuses = async (req, res) => {
    try {
        await seedDefaultStatuses(); // Ensure defaults exist
        const statuses = await Status.findAll({ order: [['order', 'ASC'], ['createdAt', 'ASC']] });
        res.status(200).json({ success: true, data: statuses });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Add status
// @route   POST /api/settings/statuses
// @access  Private/Admin
export const addStatus = async (req, res) => {
    try {
        const { label, color } = req.body;
        if (!label) return res.status(400).json({ success: false, message: 'Label is required' });

        // Generate value/slug
        const value = label.toLowerCase().replace(/[^a-z0-9]/g, '-');

        const existing = await Status.findOne({ where: { value } });
        if (existing) return res.status(400).json({ success: false, message: 'Status already exists' });

        const maxOrder = await Status.max('order') || 0;

        const status = await Status.create({
            label,
            value,
            color: color || 'gray',
            order: maxOrder + 1
        });
        res.status(201).json({ success: true, data: status });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete status
// @route   DELETE /api/settings/statuses/:id
// @access  Private/Admin
export const deleteStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const status = await Status.findByPk(id);

        if (!status) return res.status(404).json({ success: false, message: 'Status not found' });

        // Prevent deletion if referenced by existing leads
        const refCount = await Lead.count({ where: { status: status.value } });
        if (refCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete status '${status.label}' because it is currently assigned to ${refCount} lead(s).`
            });
        }

        await status.destroy();
        res.status(200).json({ success: true, message: 'Status removed' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all countries
// @route   GET /api/settings/countries
// @access  Private
export const getCountries = async (req, res) => {
    try {
        const countries = await Country.findAll({ order: [['name', 'ASC']] });
        res.status(200).json({ success: true, data: countries });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Add country
// @route   POST /api/settings/countries
// @access  Private/Admin
export const addCountry = async (req, res) => {
    try {
        const { name, code } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });

        const existing = await Country.findOne({ where: { name } });
        if (existing) return res.status(400).json({ success: false, message: 'Country already exists' });

        const country = await Country.create({ name, code });
        res.status(201).json({ success: true, data: country });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete country
// @route   DELETE /api/settings/countries/:id
// @access  Private/Admin
export const deleteCountry = async (req, res) => {
    try {
        const { id } = req.params;
        const country = await Country.findByPk(id);
        if (!country) return res.status(404).json({ success: false, message: 'Country not found' });

        // Prevent deletion if referenced by existing leads
        const refCount = await Lead.count({ where: { country: country.name } });
        if (refCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete country '${country.name}' because it is currently referenced by ${refCount} lead(s).`
            });
        }

        await country.destroy();
        res.status(200).json({ success: true, message: 'Country removed' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all products
// @route   GET /api/settings/products
// @access  Private
export const getProducts = async (req, res) => {
    try {
        const products = await Product.findAll({ order: [['name', 'ASC']] });
        res.status(200).json({ success: true, data: products });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Add product
// @route   POST /api/settings/products
// @access  Private/Admin
export const addProduct = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });

        const existing = await Product.findOne({ where: { name } });
        if (existing) return res.status(400).json({ success: false, message: 'Product already exists' });

        const product = await Product.create({ name });
        res.status(201).json({ success: true, data: product });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete product
// @route   DELETE /api/settings/products/:id
// @access  Private/Admin
export const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findByPk(id);
        if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

        // Prevent deletion if referenced by existing leads
        const refCount = await Lead.count({ where: { product: product.name } });
        if (refCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete product '${product.name}' because it is currently referenced by ${refCount} lead(s).`
            });
        }

        await product.destroy();
        res.status(200).json({ success: true, message: 'Product removed' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- Branding Handlers ---

// @desc    Get public branding details (unauthenticated)
// @route   GET /api/settings/branding/public
// @access  Public
export const getPublicBranding = async (req, res) => {
    try {
        let branding = await AppBranding.findOne();
        if (!branding) {
            branding = await AppBranding.create({ appName: 'CRM Demo', location: null });
        }
        res.status(200).json({
            success: true,
            data: {
                appName: branding.appName,
                location: branding.location,
                logoUrl: branding.logoUrl,
                faviconUrl: branding.faviconUrl
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
            data: { appName: 'CRM Demo', location: null, logoUrl: null, faviconUrl: null }
        });
    }
};

// @desc    Get full branding details (authenticated)
// @route   GET /api/settings/branding
// @access  Private
export const getBranding = async (req, res) => {
    try {
        let branding = await AppBranding.findOne();
        if (!branding) {
            branding = await AppBranding.create({ appName: 'CRM Demo', location: null });
        }
        res.status(200).json({ success: true, data: branding });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update application branding (name & location)
// @route   PUT /api/settings/branding
// @access  Private/Admin
export const updateBranding = async (req, res) => {
    try {
        let { appName, location } = req.body;

        if (!appName || typeof appName !== 'string') {
            return res.status(400).json({ success: false, message: 'Application name is required' });
        }

        appName = appName.trim();

        // Length and safety validation for appName
        if (appName.length < 2 || appName.length > 60) {
            return res.status(400).json({ success: false, message: 'Application name must be between 2 and 60 characters' });
        }

        // Prevent HTML / Script tag injection
        if (/<[^>]*>/g.test(appName) || /javascript:/i.test(appName)) {
            return res.status(400).json({ success: false, message: 'Invalid characters in application name' });
        }

        // Validate and clean location
        let cleanLocation = null;
        if (location !== undefined && location !== null) {
            if (typeof location !== 'string') {
                return res.status(400).json({ success: false, message: 'Location must be a string' });
            }
            cleanLocation = location.trim();
            if (cleanLocation.length > 60) {
                return res.status(400).json({ success: false, message: 'Location must be 60 characters or fewer' });
            }
            if (/<[^>]*>/g.test(cleanLocation) || /javascript:/i.test(cleanLocation)) {
                return res.status(400).json({ success: false, message: 'Invalid characters in location' });
            }
            if (cleanLocation.length === 0) {
                cleanLocation = null;
            }
        }

        let branding = await AppBranding.findOne();
        if (!branding) {
            branding = await AppBranding.create({ appName, location: cleanLocation, updatedBy: req.user.id });
        } else {
            branding.appName = appName;
            if (location !== undefined) {
                branding.location = cleanLocation;
            }
            branding.updatedBy = req.user.id;
            await branding.save();
        }

        res.status(200).json({ success: true, data: branding, message: 'Branding updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Upload application logo
// @route   POST /api/settings/branding/logo
// @access  Private/Admin
export const uploadBrandingLogo = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Please upload a logo file' });
        }

        const relativePath = `/uploads/branding/${req.file.filename}`;
        let branding = await AppBranding.findOne();

        if (!branding) {
            branding = await AppBranding.create({ appName: 'CRM Demo', location: null, logoUrl: relativePath, updatedBy: req.user.id });
        } else {
            branding.logoUrl = relativePath;
            branding.updatedBy = req.user.id;
            await branding.save();
        }

        res.status(200).json({ success: true, data: branding, message: 'Logo uploaded successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Upload application favicon
// @route   POST /api/settings/branding/favicon
// @access  Private/Admin
export const uploadBrandingFavicon = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Please upload a favicon file' });
        }

        const relativePath = `/uploads/branding/${req.file.filename}`;
        let branding = await AppBranding.findOne();

        if (!branding) {
            branding = await AppBranding.create({ appName: 'CRM Demo', location: null, faviconUrl: relativePath, updatedBy: req.user.id });
        } else {
            branding.faviconUrl = relativePath;
            branding.updatedBy = req.user.id;
            await branding.save();
        }

        res.status(200).json({ success: true, data: branding, message: 'Favicon uploaded successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Remove custom logo
// @route   DELETE /api/settings/branding/logo
// @access  Private/Admin
export const removeBrandingLogo = async (req, res) => {
    try {
        let branding = await AppBranding.findOne();
        if (branding) {
            branding.logoUrl = null;
            branding.updatedBy = req.user.id;
            await branding.save();
        }
        res.status(200).json({ success: true, data: branding, message: 'Custom logo removed' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Remove custom favicon
// @route   DELETE /api/settings/branding/favicon
// @access  Private/Admin
export const removeBrandingFavicon = async (req, res) => {
    try {
        let branding = await AppBranding.findOne();
        if (branding) {
            branding.faviconUrl = null;
            branding.updatedBy = req.user.id;
            await branding.save();
        }
        res.status(200).json({ success: true, data: branding, message: 'Custom favicon removed' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Reset branding to default
// @route   POST /api/settings/branding/reset
// @access  Private/Admin
export const resetBranding = async (req, res) => {
    try {
        let branding = await AppBranding.findOne();
        if (!branding) {
            branding = await AppBranding.create({ appName: 'CRM Demo', location: null, logoUrl: null, faviconUrl: null, updatedBy: req.user.id });
        } else {
            branding.appName = 'CRM Demo';
            branding.location = null;
            branding.logoUrl = null;
            branding.faviconUrl = null;
            branding.updatedBy = req.user.id;
            await branding.save();
        }

        res.status(200).json({ success: true, data: branding, message: 'Branding reset to default' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};



