import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { settingsAPI } from '../services/api';
import defaultLogo from '../assets/logo.png';

const BrandingContext = createContext(null);

export const BrandingProvider = ({ children }) => {
  const [branding, setBranding] = useState({
    appName: 'CRM Demo',
    location: null,
    logoUrl: null,
    faviconUrl: null,
    loading: true
  });

  const getFullAssetUrl = (path) => {
    if (!path) return defaultLogo;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const origin = baseURL.replace(/\/api\/?$/, '');
    return `${origin}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  const updateFavicon = (faviconPath) => {
    try {
      let link = document.querySelector("link[rel*='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      if (faviconPath) {
        link.href = getFullAssetUrl(faviconPath);
      } else {
        link.href = '/vite.svg';
      }
    } catch (e) {
      // Ignore favicon DOM update errors in test environments
    }
  };

  const fetchBranding = useCallback(async () => {
    try {
      const res = await settingsAPI.getPublicBranding();
      if (res?.data?.success && res.data.data) {
        const { appName, location, logoUrl, faviconUrl } = res.data.data;
        const finalName = (appName && appName.trim()) ? appName.trim() : 'CRM Demo';
        const finalLocation = (location && location.trim()) ? location.trim() : null;
        setBranding({
          appName: finalName,
          location: finalLocation,
          logoUrl,
          faviconUrl,
          loading: false
        });
        document.title = finalLocation ? `${finalName} | ${finalLocation}` : finalName;
        updateFavicon(faviconUrl);
      } else {
        setBranding(prev => ({ ...prev, loading: false }));
      }
    } catch (err) {
      console.warn('Failed to load branding, using default "CRM Demo":', err?.message);
      setBranding({
        appName: 'CRM Demo',
        location: null,
        logoUrl: null,
        faviconUrl: null,
        loading: false
      });
      document.title = 'CRM Demo';
    }
  }, []);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  const refreshBranding = async () => {
    await fetchBranding();
  };

  const value = {
    appName: branding.appName || 'CRM Demo',
    location: branding.location || '',
    rawLocation: branding.location,
    logoUrl: getFullAssetUrl(branding.logoUrl),
    rawLogoUrl: branding.logoUrl,
    faviconUrl: branding.faviconUrl,
    loading: branding.loading,
    refreshBranding,
    getFullAssetUrl
  };

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
};
