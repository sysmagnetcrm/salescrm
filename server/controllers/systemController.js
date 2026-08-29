// @desc    Get system version and client compatibility requirements
// @route   GET /api/system/version
// @access  Public
export const getSystemVersion = (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      currentVersion: '1.2.0',
      minSupportedVersion: '1.0.0',
      updateRequired: false,
      message: 'System operating normally'
    }
  });
};
