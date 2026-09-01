import { useState, useEffect } from 'react';
import { settingsAPI } from '../../services/api';
import { useBranding } from '../../context/BrandingContext';
import { Trash2, Plus, Package, Tag, Image as ImageIcon, RotateCcw, Upload, Check, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';

const ManageLists = () => {
    const [products, setProducts] = useState([]);
    const [statuses, setStatuses] = useState([]);
    const [loading, setLoading] = useState(true);

    const [newProduct, setNewProduct] = useState('');
    const [newStatus, setNewStatus] = useState({ label: '', color: 'gray' });

    // Collapsible state for Application Branding (defaults to collapsed/shrunk)
    const [isBrandingExpanded, setIsBrandingExpanded] = useState(false);

    // Branding State
    const { appName, location, logoUrl, rawLogoUrl, faviconUrl, refreshBranding, getFullAssetUrl } = useBranding();
    const [brandingName, setBrandingName] = useState(appName || 'CRM Demo');
    const [brandingLocation, setBrandingLocation] = useState(location || '');
    const [savingName, setSavingName] = useState(false);

    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState(null);
    const [uploadingLogo, setUploadingLogo] = useState(false);

    const [faviconFile, setFaviconFile] = useState(null);
    const [faviconPreview, setFaviconPreview] = useState(null);
    const [uploadingFavicon, setUploadingFavicon] = useState(false);

    const handleRemoveLogo = async () => {
        if (!window.confirm('Remove custom logo and revert to default logo?')) return;
        try {
            await settingsAPI.removeLogo();
            toast.success('Custom logo removed');
            setLogoFile(null);
            setLogoPreview(null);
            await refreshBranding();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to remove custom logo');
        }
    };

    const handleRemoveFavicon = async () => {
        if (!window.confirm('Remove custom favicon?')) return;
        try {
            await settingsAPI.removeFavicon();
            toast.success('Custom favicon removed');
            setFaviconFile(null);
            setFaviconPreview(null);
            await refreshBranding();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to remove custom favicon');
        }
    };

    const COLORS = [
        { name: 'gray', class: 'bg-gray-100 text-gray-800' },
        { name: 'blue', class: 'bg-blue-100 text-blue-800' },
        { name: 'green', class: 'bg-green-100 text-green-800' },
        { name: 'red', class: 'bg-red-100 text-red-800' },
        { name: 'orange', class: 'bg-orange-100 text-orange-800' },
        { name: 'purple', class: 'bg-purple-100 text-purple-800' },
        { name: 'indigo', class: 'bg-indigo-100 text-indigo-800' },
        { name: 'pink', class: 'bg-pink-100 text-pink-800' },
        { name: 'yellow', class: 'bg-yellow-100 text-yellow-800' }
    ];

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        setBrandingName(appName || 'CRM Demo');
        setBrandingLocation(location || '');
    }, [appName, location]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [productRes, statusRes] = await Promise.all([
                settingsAPI.getProducts(),
                settingsAPI.getStatuses()
            ]);
            setProducts(productRes.data.data);
            setStatuses(statusRes.data.data);
        } catch (error) {
            toast.error('Failed to load master lists');
        } finally {
            setLoading(false);
        }
    };

    const handleAddProduct = async (e) => {
        e.preventDefault();
        if (!newProduct.trim()) return;
        try {
            await settingsAPI.addProduct({ name: newProduct });
            toast.success('Product added');
            setNewProduct('');
            const res = await settingsAPI.getProducts();
            setProducts(res.data.data);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to add product');
        }
    };

    const handleDeleteProduct = async (id) => {
        if (!window.confirm('Delete this product?')) return;
        try {
            await settingsAPI.deleteProduct(id);
            toast.success('Product removed');
            setProducts(products.filter(p => p.id !== id));
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete product');
        }
    };

    const handleAddStatus = async (e) => {
        e.preventDefault();
        if (!newStatus.label.trim()) return;
        try {
            await settingsAPI.addStatus(newStatus);
            toast.success('Status added');
            setNewStatus({ label: '', color: 'gray' });
            const res = await settingsAPI.getStatuses();
            setStatuses(res.data.data);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to add status');
        }
    };

    const handleDeleteStatus = async (id) => {
        if (!window.confirm('Delete this status?')) return;
        try {
            await settingsAPI.deleteStatus(id);
            toast.success('Status removed');
            setStatuses(statuses.filter(s => s.id !== id));
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete status');
        }
    };

    // Branding Handlers
    const handleSaveBrandingDetails = async (e) => {
        e.preventDefault();
        if (!brandingName.trim()) {
            toast.error('Application name cannot be empty');
            return;
        }
        setSavingName(true);
        try {
            await settingsAPI.updateBranding({
                appName: brandingName,
                location: brandingLocation
            });
            toast.success('Branding details updated successfully');
            await refreshBranding();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update branding details');
        } finally {
            setSavingName(false);
        }
    };

    const handleLogoChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            toast.error('Logo image must be smaller than 2MB');
            return;
        }

        setLogoFile(file);
        setLogoPreview(URL.createObjectURL(file));
    };

    const handleUploadLogo = async () => {
        if (!logoFile) return;
        setUploadingLogo(true);
        try {
            const formData = new FormData();
            formData.append('logo', logoFile);
            await settingsAPI.uploadLogo(formData);
            toast.success('Logo uploaded successfully');
            setLogoFile(null);
            setLogoPreview(null);
            await refreshBranding();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to upload logo');
        } finally {
            setUploadingLogo(false);
        }
    };

    const handleFaviconChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            toast.error('Favicon file must be smaller than 2MB');
            return;
        }

        setFaviconFile(file);
        setFaviconPreview(URL.createObjectURL(file));
    };

    const handleUploadFavicon = async () => {
        if (!faviconFile) return;
        setUploadingFavicon(true);
        try {
            const formData = new FormData();
            formData.append('favicon', faviconFile);
            await settingsAPI.uploadFavicon(formData);
            toast.success('Favicon uploaded successfully');
            setFaviconFile(null);
            setFaviconPreview(null);
            await refreshBranding();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to upload favicon');
        } finally {
            setUploadingFavicon(false);
        }
    };

    const handleResetBranding = async () => {
        if (!window.confirm('Are you sure you want to reset branding to default "CRM Demo", unconfigured location, and default logo?')) return;
        try {
            await settingsAPI.resetBranding();
            toast.success('Branding reset to default');
            setLogoFile(null);
            setLogoPreview(null);
            setFaviconFile(null);
            setFaviconPreview(null);
            await refreshBranding();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to reset branding');
        }
    };

    const getColorClass = (colorName) => {
        const found = COLORS.find(c => c.name === colorName);
        return found ? found.class : 'bg-gray-100 text-gray-800';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center border-b pb-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Manage Products & Application Branding</h1>
                    <p className="text-gray-600 text-sm">Configure master products, lead statuses, and global application branding</p>
                </div>
            </div>

            {/* Application Branding Management Card (Collapsible) */}
            <div className="card bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all">
                {/* Header Bar - Clickable to toggle collapse/expand */}
                <div
                    onClick={() => setIsBrandingExpanded(!isBrandingExpanded)}
                    className="p-5 flex items-center justify-between cursor-pointer hover:bg-gray-50/80 transition-colors select-none"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary-50 text-primary-600 rounded-lg">
                            <ImageIcon className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                Application Branding
                                <span className="text-xs px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-normal border border-gray-200">
                                    {isBrandingExpanded ? 'Click to collapse' : 'Click to expand'}
                                </span>
                            </h2>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Current: <span className="font-semibold text-gray-800">{appName || 'CRM Demo'}</span>
                                {location ? ` • ${location}` : ''}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {isBrandingExpanded && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleResetBranding();
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                title="Reset branding to CRM Demo default"
                            >
                                <RotateCcw className="h-3.5 w-3.5 text-gray-600" />
                                Reset Default
                            </button>
                        )}
                        <div className="p-1.5 rounded-full text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors">
                            {isBrandingExpanded ? (
                                <ChevronUp className="h-5 w-5" />
                            ) : (
                                <ChevronDown className="h-5 w-5" />
                            )}
                        </div>
                    </div>
                </div>

                {/* Collapsible Content */}
                {isBrandingExpanded && (
                    <div className="p-6 pt-2 border-t border-gray-100 bg-white">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {/* 1. App Name & Location Form */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Identity & Location</h3>
                                <form onSubmit={handleSaveBrandingDetails} className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">CRM Name</label>
                                        <input
                                            type="text"
                                            className="input-field w-full"
                                            value={brandingName}
                                            onChange={(e) => setBrandingName(e.target.value)}
                                            placeholder="e.g. CRM Demo"
                                            minLength={2}
                                            maxLength={60}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Location (Optional)</label>
                                        <input
                                            type="text"
                                            className="input-field w-full"
                                            value={brandingLocation}
                                            onChange={(e) => setBrandingLocation(e.target.value)}
                                            placeholder="e.g. Kochi, Chennai, Alappuzha"
                                            maxLength={60}
                                        />
                                        <span className="text-[11px] text-gray-400 mt-1 block">
                                            {brandingLocation ? `Configured: ${brandingLocation}` : 'Location: Not configured'}
                                        </span>
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={savingName}
                                        className="w-full btn-primary py-2 text-sm flex items-center justify-center gap-2"
                                    >
                                        <Check className="h-4 w-4" />
                                        {savingName ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </form>
                            </div>

                            {/* 2. Logo Upload & Preview */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Logo Management</h3>
                                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex flex-col items-center justify-center min-h-[100px] relative">
                                    <span className="text-xs text-gray-500 mb-2">Current / New Preview</span>
                                    <img
                                        src={logoPreview || logoUrl}
                                        alt="CRM Logo Preview"
                                        className="h-10 w-auto object-contain max-w-full"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <input
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                        onChange={handleLogoChange}
                                        className="block w-full text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                                    />
                                    {logoFile && (
                                        <button
                                            onClick={handleUploadLogo}
                                            disabled={uploadingLogo}
                                            className="w-full btn-primary py-2 text-sm flex items-center justify-center gap-2"
                                        >
                                            <Upload className="h-4 w-4" />
                                            {uploadingLogo ? 'Uploading...' : 'Save Uploaded Logo'}
                                        </button>
                                    )}
                                    {rawLogoUrl && (
                                        <button
                                            type="button"
                                            onClick={handleRemoveLogo}
                                            className="w-full py-1.5 px-3 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            Remove Current Logo
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* 3. Favicon Upload & Preview */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Favicon Management</h3>
                                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex flex-col items-center justify-center min-h-[100px]">
                                    <span className="text-xs text-gray-500 mb-2">Favicon Preview</span>
                                    {faviconPreview || faviconUrl ? (
                                        <img
                                            src={faviconPreview || getFullAssetUrl(faviconUrl)}
                                            alt="Favicon Preview"
                                            className="h-8 w-8 object-contain"
                                        />
                                    ) : (
                                        <span className="text-xs text-gray-400 italic">Default Browser Favicon</span>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <input
                                        type="file"
                                        accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml"
                                        onChange={handleFaviconChange}
                                        className="block w-full text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                                    />
                                    {faviconFile && (
                                        <button
                                            onClick={handleUploadFavicon}
                                            disabled={uploadingFavicon}
                                            className="w-full btn-primary py-2 text-sm flex items-center justify-center gap-2"
                                        >
                                            <Upload className="h-4 w-4" />
                                            {uploadingFavicon ? 'Uploading...' : 'Save Uploaded Favicon'}
                                        </button>
                                    )}
                                    {faviconUrl && (
                                        <button
                                            type="button"
                                            onClick={handleRemoveFavicon}
                                            className="w-full py-1.5 px-3 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            Remove Current Favicon
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Master Lists Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Products Card */}
                <div className="card bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-center gap-2 mb-4 border-b pb-2">
                        <Package className="h-5 w-5 text-primary-600" />
                        <h2 className="text-lg font-semibold text-gray-800">Products</h2>
                    </div>

                    <form onSubmit={handleAddProduct} className="flex gap-2 mb-4">
                        <input
                            type="text"
                            className="input-field flex-1"
                            placeholder="Add new product..."
                            value={newProduct}
                            onChange={(e) => setNewProduct(e.target.value)}
                        />
                        <button type="submit" className="btn-primary p-2">
                            <Plus className="h-5 w-5" />
                        </button>
                    </form>

                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                        {products.map((product) => (
                            <div key={product.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-100 group hover:bg-white hover:border-gray-200 transition-colors">
                                <span className="font-medium text-gray-700">{product.name}</span>
                                <button
                                    onClick={() => handleDeleteProduct(product.id)}
                                    className="text-gray-400 hover:text-red-600 p-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Remove"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                        {products.length === 0 && (
                            <p className="text-gray-500 text-sm text-center italic py-2">No products added in master list</p>
                        )}
                    </div>
                </div>

                {/* Custom Statuses Card */}
                <div className="card bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-center gap-2 mb-4 border-b pb-2">
                        <Tag className="h-5 w-5 text-primary-600" />
                        <h2 className="text-lg font-semibold text-gray-800">Lead Statuses</h2>
                    </div>

                    <form onSubmit={handleAddStatus} className="flex gap-2 mb-4 items-center">
                        <input
                            type="text"
                            className="input-field flex-1"
                            placeholder="New status label..."
                            value={newStatus.label}
                            onChange={(e) => setNewStatus({ ...newStatus, label: e.target.value })}
                            required
                        />
                        <select
                            className="input-field w-32"
                            value={newStatus.color}
                            onChange={(e) => setNewStatus({ ...newStatus, color: e.target.value })}
                        >
                            {COLORS.map(color => (
                                <option key={color.name} value={color.name}>{color.name}</option>
                            ))}
                        </select>
                        <button type="submit" className="btn-primary p-2">
                            <Plus className="h-5 w-5" />
                        </button>
                    </form>

                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                        {statuses.map((status) => (
                            <div key={status.id} className="flex items-center justify-between p-2 bg-white rounded border border-gray-100 group hover:border-gray-200 transition-colors">
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getColorClass(status.color)}`}>
                                    {status.label}
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400">Order: {status.order}</span>
                                    <button
                                        onClick={() => handleDeleteStatus(status.id)}
                                        className="text-gray-400 hover:text-red-600 p-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Remove"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {statuses.length === 0 && (
                            <p className="text-gray-500 text-sm text-center italic py-2">No custom statuses found</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManageLists;
