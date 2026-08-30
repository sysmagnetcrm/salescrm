export const DEVICE_COMPATIBILITY_REGISTRY = [
  {
    manufacturer: 'Xiaomi',
    model: '24053PY09I',
    brandName: 'Xiaomi 14 Civi',
    androidVersion: 'Android 16 (SDK 36)',
    oemVersion: 'Xiaomi HyperOS 2 (V816)',
    defaultDialer: 'SUPPORTED',
    callTracking: 'VERIFIED',
    recordingCapability: 'VERIFIED',
    recordingAccess: 'VERIFIED',
    backgroundReliability: 'VERIFIED (Requires Xiaomi Auto-Start)',
    status: 'VERIFIED'
  }
];

export const getDeviceCompatibilityStatus = (brand = '', model = '') => {
  const normalizedBrand = brand.toLowerCase().trim();
  const normalizedModel = model.toLowerCase().trim();

  const match = DEVICE_COMPATIBILITY_REGISTRY.find(
    (d) => d.manufacturer.toLowerCase() === normalizedBrand || d.model.toLowerCase() === normalizedModel
  );

  if (match) {
    return match;
  }

  return {
    manufacturer: brand || 'Unknown OEM',
    model: model || 'Generic Android Device',
    brandName: `${brand} ${model}`.trim(),
    androidVersion: 'Generic Android',
    oemVersion: 'Generic ROM',
    defaultDialer: 'SUPPORTED',
    callTracking: 'SUPPORTED',
    recordingCapability: 'NOT VERIFIED',
    recordingAccess: 'NOT VERIFIED',
    backgroundReliability: 'NOT VERIFIED',
    status: 'NOT VERIFIED'
  };
};
