import { DispositionSettings } from '../models/index.js';

const DEFAULT_DISPOSITIONS = [
  { label: 'Connected', category: 'connected', requiresFollowUp: false, displayOrder: 1 },
  { label: 'Follow-up Required', category: 'callback', requiresFollowUp: true, displayOrder: 2 },
  { label: 'Call Back Requested', category: 'callback', requiresFollowUp: true, displayOrder: 3 },
  { label: 'Interested', category: 'connected', requiresFollowUp: true, displayOrder: 4 },
  { label: 'RNR (Ring No Response)', category: 'no_answer', requiresFollowUp: true, displayOrder: 5 },
  { label: 'Busy', category: 'busy', requiresFollowUp: true, displayOrder: 6 },
  { label: 'No Answer', category: 'no_answer', requiresFollowUp: true, displayOrder: 7 },
  { label: 'Not Interested', category: 'not_interested', requiresFollowUp: false, displayOrder: 8 },
  { label: 'Registered', category: 'registered', requiresFollowUp: false, displayOrder: 9 },
  { label: 'Duplicate Lead', category: 'duplicate', requiresFollowUp: false, displayOrder: 10 },
  { label: 'Wrong Number', category: 'other', requiresFollowUp: false, displayOrder: 11 }
];

export const seedDefaultDispositions = async () => {
  try {
    const count = await DispositionSettings.count();
    if (count === 0) {
      await DispositionSettings.bulkCreate(DEFAULT_DISPOSITIONS);
      console.log('✅ Seeded default disposition settings.');
    }
  } catch (error) {
    console.error('❌ Error seeding dispositions:', error);
  }
};

// @desc    Get active disposition options
// @route   GET /api/settings/dispositions
// @access  Private
export const getDispositions = async (req, res) => {
  try {
    let items = await DispositionSettings.findAll({
      where: { isActive: true },
      order: [['displayOrder', 'ASC'], ['label', 'ASC']]
    });

    if (items.length === 0) {
      await seedDefaultDispositions();
      items = await DispositionSettings.findAll({
        where: { isActive: true },
        order: [['displayOrder', 'ASC'], ['label', 'ASC']]
      });
    }

    res.status(200).json({
      success: true,
      data: items
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create new disposition option
// @route   POST /api/settings/dispositions
// @access  Private/Admin
export const createDisposition = async (req, res) => {
  try {
    const { label, category, requiresFollowUp, displayOrder } = req.body;

    if (!label) {
      return res.status(400).json({ success: false, message: 'Label is required.' });
    }

    const item = await DispositionSettings.create({
      label: label.trim(),
      category: category || 'connected',
      requiresFollowUp: Boolean(requiresFollowUp),
      displayOrder: displayOrder ? parseInt(displayOrder) : 0
    });

    res.status(201).json({
      success: true,
      data: item
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
