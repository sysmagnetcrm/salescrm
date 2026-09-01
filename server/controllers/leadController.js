import { Lead, User, Activity, Status, AssignmentHistory, CallLog } from '../models/index.js';
import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import { parseFile, deleteFile } from '../utils/fileParser.js';
import { LEAD_STATUS, normalizeStatus } from '../utils/statusConstants.js';

const likeOp = sequelize.getDialect() === 'postgres' ? Op.iLike : Op.like;

// Helper to normalize phone numbers for duplicate checking
const normalizePhone = (phone) => {
  if (!phone) return '';
  return String(phone).replace(/[^0-9]/g, '');
};

// Helper to normalize email for duplicate checking
const normalizeEmail = (email) => {
  if (!email) return '';
  return String(email).trim().toLowerCase();
};

// @desc    Upload and batch process leads with duplicate detection
// @route   POST /api/leads/upload
// @access  Private/Admin
export const uploadLeads = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a file'
      });
    }

    const filePath = req.file.path;
    const targetBranch = (req.effectiveBranch || req.body.branch || req.user?.branch || '').toLowerCase();

    // Parse the file
    const parsedLeads = await parseFile(filePath);

    if (!parsedLeads || parsedLeads.length === 0) {
      deleteFile(filePath);
      return res.status(400).json({
        success: false,
        message: 'No valid leads found in file'
      });
    }

    const totalRows = parsedLeads.length;
    let validRows = 0;
    let invalidRows = 0;
    let fileDuplicates = 0;
    let crmDuplicates = 0;

    const seenPhonesInFile = new Set();
    const seenEmailsInFile = new Set();
    const leadsToProcess = [];

    // 1. Filter invalid rows & file duplicates
    for (const lead of parsedLeads) {
      const name = lead.name ? String(lead.name).trim() : '';
      const rawPhone = lead.phone ? String(lead.phone).trim() : '';
      const rawEmail = lead.email ? normalizeEmail(lead.email) : '';
      const country = lead.country ? String(lead.country).trim() : '';
      const normPhone = normalizePhone(rawPhone);

      if (!name || !rawPhone) {
        invalidRows++;
        continue;
      }

      validRows++;

      // Check file internal duplicate
      const isPhoneFileDup = normPhone && seenPhonesInFile.has(normPhone);
      const isEmailFileDup = rawEmail && seenEmailsInFile.has(rawEmail);

      if (isPhoneFileDup || isEmailFileDup) {
        fileDuplicates++;
        continue;
      }

      if (normPhone) seenPhonesInFile.add(normPhone);
      if (rawEmail) seenEmailsInFile.add(rawEmail);

      leadsToProcess.push({
        date: lead.date ? new Date(lead.date) : new Date(),
        name,
        email: rawEmail || null,
        phone: rawPhone,
        normPhone,
        country,
        product: lead.product ? String(lead.product).trim() : null,
        source: lead.source ? String(lead.source).trim() : null,
        status: normalizeStatus(lead.status || 'fresh'),
        branch: targetBranch,
        assignedTo: null
      });
    }

    if (leadsToProcess.length === 0) {
      deleteFile(filePath);
      return res.status(200).json({
        success: true,
        message: 'File processed. No new unique leads to import.',
        stats: {
          totalRows,
          validRows,
          invalidRows,
          fileDuplicates,
          crmDuplicates: 0,
          importedRows: 0,
          skippedRows: totalRows
        }
      });
    }

    // 2. Query CRM existing leads for duplicates in target branch
    const phonesToCheck = leadsToProcess.map(l => l.phone).filter(Boolean);
    const emailsToCheck = leadsToProcess.map(l => l.email).filter(Boolean);

    const existingLeads = await Lead.findAll({
      where: {
        branch: targetBranch,
        [Op.or]: [
          { phone: { [Op.in]: phonesToCheck } },
          ...(emailsToCheck.length > 0 ? [{ email: { [Op.in]: emailsToCheck } }] : [])
        ]
      },
      attributes: ['phone', 'email']
    });

    const crmPhones = new Set(existingLeads.map(l => normalizePhone(l.phone)).filter(Boolean));
    const crmEmails = new Set(existingLeads.map(l => normalizeEmail(l.email)).filter(Boolean));

    const finalLeadsToCreate = [];

    for (const item of leadsToProcess) {
      const isCrmPhoneDup = item.normPhone && crmPhones.has(item.normPhone);
      const isCrmEmailDup = item.email && crmEmails.has(item.email);

      if (isCrmPhoneDup || isCrmEmailDup) {
        crmDuplicates++;
        continue;
      }

      finalLeadsToCreate.push({
        date: item.date,
        name: item.name,
        email: item.email,
        phone: item.phone,
        country: item.country,
        product: item.product,
        source: item.source,
        status: item.status,
        branch: item.branch,
        assignedTo: null,
        value: 0
      });
    }

    // 3. Batch insert using transaction in chunks of 100
    const BATCH_SIZE = 100;
    const createdLeads = [];

    for (let i = 0; i < finalLeadsToCreate.length; i += BATCH_SIZE) {
      const chunk = finalLeadsToCreate.slice(i, i + BATCH_SIZE);
      const transaction = await sequelize.transaction();
      try {
        const batchCreated = await Lead.bulkCreate(chunk, { transaction });
        await transaction.commit();
        createdLeads.push(...batchCreated);
      } catch (batchErr) {
        await transaction.rollback();
        console.error('Batch insert error:', batchErr);
        throw batchErr;
      }
    }

    deleteFile(filePath);

    res.status(201).json({
      success: true,
      message: `${createdLeads.length} leads imported successfully into branch '${targetBranch}'`,
      stats: {
        totalRows,
        validRows,
        invalidRows,
        fileDuplicates,
        crmDuplicates,
        importedRows: createdLeads.length,
        skippedRows: totalRows - createdLeads.length
      }
    });
  } catch (error) {
    if (req.file) deleteFile(req.file.path);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Create a single lead manually
// @route   POST /api/leads
// @access  Private (Admin/Accountant/Salesperson)
export const createLead = async (req, res) => {
  try {
    const { name, phone, country, email, product, source, value, notes, date, assignedTo, branch, referenceName, referenceNumber } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Name and phone are required' });
    }

    // Financial value validation
    let numValue = 0;
    if (value !== undefined && value !== null && value !== '') {
      numValue = Number(value);
      if (isNaN(numValue) || !isFinite(numValue) || numValue < 0) {
        return res.status(422).json({
          success: false,
          message: 'Invalid financial value. Value must be a non-negative number.'
        });
      }
    }

    const leadBranch = req.user.role === 'salesperson' ? (req.user.branch || '').toLowerCase() : ((req.effectiveBranch || branch || req.user.branch || '').toLowerCase());

    // Determine assignment rules
    let assigned = null;
    let targetSalesperson = null;

    if (['admin', 'accountant'].includes(req.user.role)) {
      if (assignedTo) {
        targetSalesperson = await User.findByPk(assignedTo);
        if (!targetSalesperson || targetSalesperson.role !== 'salesperson' || !targetSalesperson.isActive) {
          return res.status(400).json({ success: false, message: 'assignedTo must be an active salesperson' });
        }
        assigned = targetSalesperson.id;
      }
    } else if (req.user.role === 'salesperson') {
      assigned = req.user.id;
    }

    const normInputPhone = normalizePhone(phone);
    if (normInputPhone && assigned) {
      const allLeadsWithPhone = await Lead.findAll({
        include: [{ model: User, as: 'salesperson', attributes: ['id', 'name', 'email'] }]
      });
      const activeDuplicate = allLeadsWithPhone.find(l => l.assignedTo && normalizePhone(l.phone) === normInputPhone);

      if (activeDuplicate) {
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_ACTIVE_ASSIGNMENT',
          message: 'Lead with this phone number is already actively assigned to another salesperson.',
          existingLeadId: activeDuplicate.id,
          assignedTo: activeDuplicate.salesperson ? {
            id: activeDuplicate.salesperson.id,
            name: activeDuplicate.salesperson.name,
            email: activeDuplicate.salesperson.email
          } : null
        });
      }
    }

    const transaction = await sequelize.transaction();
    try {
      const created = await Lead.create({
        name: String(name).trim(),
        phone: String(phone).trim(),
        country: country ? String(country).trim() : 'India',
        email: email ? normalizeEmail(email) : null,
        product: product ? String(product).trim() : null,
        source: source ? String(source).trim() : null,
        value: numValue,
        notes: notes ? String(notes).trim() : null,
        date: date ? new Date(date) : new Date(),
        assignedTo: assigned,
        status: LEAD_STATUS.FRESH,
        branch: leadBranch,
        referenceName: referenceName ? String(referenceName).trim() : null,
        referenceNumber: referenceNumber ? String(referenceNumber).trim() : null
      }, { transaction });

      // Log Assignment History if assigned
      if (assigned) {
        await AssignmentHistory.create({
          leadId: created.id,
          fromUserId: null,
          toUserId: assigned,
          assignedBy: req.user.id,
          assignedAt: new Date(),
          reason: 'Initial lead creation assignment'
        }, { transaction });

        await Activity.create({
          leadId: created.id,
          userId: req.user.id,
          type: 'note',
          description: `Lead created and assigned to ${targetSalesperson ? targetSalesperson.name : req.user.name}`
        }, { transaction });
      }

      await transaction.commit();

      const leadWithUser = await Lead.findByPk(created.id, {
        include: [{ model: User, as: 'salesperson', attributes: ['id', 'name', 'email'] }]
      });

      return res.status(201).json({ success: true, data: leadWithUser });
    } catch (createErr) {
      await transaction.rollback();
      throw createErr;
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all leads (Admin)
// @route   GET /api/leads
// @access  Private/Admin
export const getAllLeads = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 50, country, source, product, assignedTo, startDate, endDate, date, branch } = req.query;

    const where = {};
    const effectiveBranch = req.effectiveBranch || (branch ? branch.toLowerCase() : null);

    if (effectiveBranch) {
      where.branch = effectiveBranch;
    }

    if (status) {
      where.status = normalizeStatus(status);
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end.getHours() === 0) end.setHours(23, 59, 59, 999);
      where.createdAt = { [Op.gte]: start, [Op.lte]: end };
    } else if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setDate(end.getDate() + 1);
      where.createdAt = { [Op.gte]: start, [Op.lt]: end };
    }

    if (assignedTo) {
      where.assignedTo = assignedTo;
    }

    if (req.query.assignedStartDate && req.query.assignedEndDate) {
      const aStart = new Date(req.query.assignedStartDate);
      const aEnd = new Date(req.query.assignedEndDate);
      if (aEnd.getHours() === 0) aEnd.setHours(23, 59, 59, 999);
      where.assignedAt = { [Op.gte]: aStart, [Op.lte]: aEnd };
    }

    if (country) {
      where.country = { [likeOp]: `%${country}%` };
    }

    if (source) {
      where.source = { [likeOp]: `%${source}%` };
    }

    if (product) {
      where.product = product;
    }

    if (search) {
      where[Op.or] = [
        { name: { [likeOp]: `%${search}%` } },
        { email: { [likeOp]: `%${search}%` } },
        { phone: { [likeOp]: `%${search}%` } },
        { country: { [likeOp]: `%${search}%` } },
        { product: { [likeOp]: `%${search}%` } },
        { source: { [likeOp]: `%${search}%` } }
      ];
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await Lead.findAndCountAll({
      where,
      include: [{
        model: User,
        as: 'salesperson',
        attributes: ['id', 'name', 'email']
      }],
      order: [['assignedAt', 'DESC'], ['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Attach Call Count & Total Call Duration Aggregation per lead
    const leadIds = rows.map(l => l.id);
    const callCountMap = {};
    const callDurationMap = {};
    if (leadIds.length > 0) {
      const callStatsRaw = await CallLog.findAll({
        attributes: [
          'leadId',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          [sequelize.fn('SUM', sequelize.col('durationSeconds')), 'totalDuration']
        ],
        where: { leadId: { [Op.in]: leadIds } },
        group: ['leadId'],
        raw: true
      });
      callStatsRaw.forEach(c => {
        callCountMap[c.leadId] = parseInt(c.count) || 0;
        callDurationMap[c.leadId] = parseInt(c.totalDuration) || 0;
      });
    }

    const rowsWithCallCount = rows.map(l => {
      const plainObj = l.get({ plain: true });
      plainObj.callCount = callCountMap[l.id] || 0;
      plainObj.totalCallDuration = callDurationMap[l.id] || 0;
      return plainObj;
    });

    // Calculate status counts (ignoring status filter)
    const countsWhere = { ...where };
    delete countsWhere.status;

    const statusBreakdownRaw = await Lead.findAll({
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('status')), 'count']],
      where: countsWhere,
      group: ['status'],
      raw: true
    });

    const statusCounts = {};
    let totalComputed = 0;
    statusBreakdownRaw.forEach(item => {
      const s = item.status;
      const c = parseInt(item.count);
      statusCounts[s] = c;
      totalComputed += c;
    });
    statusCounts.all = totalComputed;

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      data: rowsWithCallCount,
      statusCounts
    });
  } catch (error) {
    console.error('GetAllLeads Error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get leads for logged in salesperson
// @route   GET /api/leads/my-leads
// @access  Private/Salesperson
export const getMyLeads = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 50, country, source, product, date, startDate, endDate, assignedStartDate, assignedEndDate } = req.query;
    const userId = req.user.id;
    const where = { assignedTo: userId };

    if (status) {
      where.status = normalizeStatus(status);
    }

    if (assignedStartDate && assignedEndDate) {
      const aStart = new Date(assignedStartDate);
      const aEnd = new Date(assignedEndDate);
      if (aEnd.getHours() === 0) aEnd.setHours(23, 59, 59, 999);
      where.assignedAt = { [Op.gte]: aStart, [Op.lte]: aEnd };
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end.getHours() === 0) end.setHours(23, 59, 59, 999);
      where.createdAt = { [Op.gte]: start, [Op.lte]: end };
    } else if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setDate(end.getDate() + 1);
      where.createdAt = { [Op.gte]: start, [Op.lt]: end };
    }

    if (country) where.country = { [likeOp]: `%${country}%` };
    if (source) where.source = { [likeOp]: `%${source}%` };
    if (product) where.product = product;

    if (search) {
      where[Op.or] = [
        { name: { [likeOp]: `%${search}%` } },
        { email: { [likeOp]: `%${search}%` } },
        { phone: { [likeOp]: `%${search}%` } },
        { country: { [likeOp]: `%${search}%` } },
        { product: { [likeOp]: `%${search}%` } },
        { source: { [likeOp]: `%${search}%` } }
      ];
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await Lead.findAndCountAll({
      where,
      order: [['assignedAt', 'DESC'], ['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const leadIds = rows.map(l => l.id);
    const callCountMap = {};
    const callDurationMap = {};
    if (leadIds.length > 0) {
      const callStatsRaw = await CallLog.findAll({
        attributes: [
          'leadId',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          [sequelize.fn('SUM', sequelize.col('durationSeconds')), 'totalDuration']
        ],
        where: { leadId: { [Op.in]: leadIds } },
        group: ['leadId'],
        raw: true
      });
      callStatsRaw.forEach(c => {
        callCountMap[c.leadId] = parseInt(c.count) || 0;
        callDurationMap[c.leadId] = parseInt(c.totalDuration) || 0;
      });
    }

    const rowsWithCallCount = rows.map(l => {
      const plainObj = l.get({ plain: true });
      plainObj.callCount = callCountMap[l.id] || 0;
      plainObj.totalCallDuration = callDurationMap[l.id] || 0;
      return plainObj;
    });

    const countsWhere = { ...where };
    delete countsWhere.status;

    const statusBreakdownRaw = await Lead.findAll({
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('status')), 'count']],
      where: countsWhere,
      group: ['status'],
      raw: true
    });

    const statusCounts = {};
    let totalComputed = 0;
    statusBreakdownRaw.forEach(item => {
      const s = item.status;
      const c = parseInt(item.count);
      statusCounts[s] = c;
      totalComputed += c;
    });
    statusCounts.all = totalComputed;

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      data: rowsWithCallCount,
      statusCounts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get single lead (with IDOR check via middleware)
// @route   GET /api/leads/:id
// @access  Private
export const getLead = async (req, res) => {
  try {
    const lead = req.lead || await Lead.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'salesperson',
          attributes: ['id', 'name', 'email', 'phone']
        },
        {
          model: Activity,
          as: 'activities',
          include: [{ model: User, as: 'user', attributes: ['id', 'name'] }],
          order: [['createdAt', 'DESC']]
        },
        {
          model: AssignmentHistory,
          as: 'assignmentHistories',
          include: [
            { model: User, as: 'fromUser', attributes: ['id', 'name'] },
            { model: User, as: 'toUser', attributes: ['id', 'name'] },
            { model: User, as: 'assigner', attributes: ['id', 'name'] }
          ],
          order: [['assignedAt', 'DESC']]
        }
      ]
    });

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    const callStatsRaw = await CallLog.findAll({
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('durationSeconds')), 'totalDuration']
      ],
      where: { leadId: lead.id },
      raw: true
    });

    const callCount = parseInt(callStatsRaw[0]?.count) || 0;
    const totalCallDuration = parseInt(callStatsRaw[0]?.totalDuration) || 0;

    const leadData = lead.get({ plain: true });
    leadData.callCount = callCount;
    leadData.totalCallDuration = totalCallDuration;

    res.status(200).json({
      success: true,
      data: leadData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update lead (with transaction and financial validation)
// @route   PUT /api/leads/:id
// @access  Private
export const updateLead = async (req, res) => {
  try {
    const lead = req.lead || await Lead.findByPk(req.params.id);

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    const { status, disposition, notes, lastCalled, value, country, product, campus, nextFollowUpAt, referenceName, referenceNumber } = req.body;

    // Validate financial value
    let normalizedValue = lead.value;
    if (value !== undefined && value !== null && value !== '') {
      const numVal = Number(value);
      if (isNaN(numVal) || !isFinite(numVal) || numVal < 0) {
        return res.status(422).json({
          success: false,
          message: 'Invalid financial value. Value must be a non-negative number.'
        });
      }
      normalizedValue = numVal;
    } else if (value === '' || value === null) {
      normalizedValue = 0;
    }

    const oldStatus = lead.status;
    const oldCountry = lead.country || null;
    const targetStatus = status ? normalizeStatus(status) : lead.status;
    const now = new Date();

    // ITEM 2: Payment-Gated Status Transition Guards
    if (targetStatus === LEAD_STATUS.ADMISSION_DONE && (parseFloat(lead.admissionFeeAmount) < 1000 || lead.admissionFeeStatus !== 'cleared')) {
      return res.status(400).json({
        success: false,
        message: 'Cannot set status to Admission Done. Requires minimum ₹1,000 admission fee payment recorded.'
      });
    }

    if (targetStatus === LEAD_STATUS.ORIENTATION_DONE && (parseFloat(lead.orientationFeeAmount) < 8000 || parseFloat(lead.totalClearedPayment) < 9000)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot set status to Orientation Done. Requires minimum ₹8,000 orientation fee (₹9,000 total cleared payment).'
      });
    }

    if (targetStatus === LEAD_STATUS.REGISTERED && (!lead.batchAllocationEligible || parseFloat(lead.totalClearedPayment) < 9000)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot set status to Registered / Batch Allocated. Minimum required cleared payment is ₹9,000.00.'
      });
    }

    const normalizedLastCalled = (lastCalled === '') ? null
      : (lastCalled !== undefined ? new Date(lastCalled) : lead.lastCalled);

    const normalizedNextFollowUp = (nextFollowUpAt === '') ? null
      : (nextFollowUpAt !== undefined ? new Date(nextFollowUpAt) : lead.nextFollowUpAt);

    // Calculate closedAt conversion timestamp
    let closedAt = lead.closedAt;
    if (targetStatus === LEAD_STATUS.REGISTERED && oldStatus !== LEAD_STATUS.REGISTERED) {
      closedAt = new Date();
    } else if (targetStatus !== LEAD_STATUS.REGISTERED && oldStatus === LEAD_STATUS.REGISTERED) {
      closedAt = null;
    }

    const transaction = await sequelize.transaction();
    try {
      await lead.update({
        status: targetStatus,
        disposition: disposition !== undefined ? (disposition ? String(disposition).trim() : null) : lead.disposition,
        notes: notes !== undefined ? notes : lead.notes,
        lastCalled: normalizedLastCalled,
        nextFollowUpAt: normalizedNextFollowUp,
        lastDispositionAt: (status || disposition) ? now : lead.lastDispositionAt,
        value: normalizedValue,
        closedAt,
        country: country ? String(country).trim() : lead.country,
        product: product !== undefined ? (product ? String(product).trim() : null) : lead.product,
        campus: campus ? String(campus).trim() : lead.campus,
        referenceName: referenceName !== undefined ? (referenceName ? String(referenceName).trim() : null) : lead.referenceName,
        referenceNumber: referenceNumber !== undefined ? (referenceNumber ? String(referenceNumber).trim() : null) : lead.referenceNumber
      }, { transaction });

      // Log status change activity
      if (status && targetStatus !== oldStatus) {
        await Activity.create({
          leadId: lead.id,
          userId: req.user.id,
          type: 'status_change',
          description: `Status changed from ${oldStatus} to ${targetStatus}`,
          oldStatus,
          newStatus: targetStatus
        }, { transaction });
      }

      // Log country change activity
      if (country !== undefined && country !== '' && country !== oldCountry) {
        await Activity.create({
          leadId: lead.id,
          userId: req.user.id,
          type: 'note',
          description: `Country changed from ${oldCountry ?? '-'} to ${country}`,
          oldCountry,
          newCountry: country
        }, { transaction });
      }

      await transaction.commit();
      await lead.reload();

      res.status(200).json({
        success: true,
        data: lead
      });
    } catch (updateErr) {
      await transaction.rollback();
      throw updateErr;
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Add activity/note to lead
// @route   POST /api/leads/:id/activity
// @access  Private
export const addActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, description } = req.body;

    if (!type || !description) {
      return res.status(400).json({ success: false, message: 'Activity type and description are required' });
    }

    const activity = await Activity.create({
      leadId: id,
      userId: req.user.id,
      type,
      description: String(description).trim()
    });

    res.status(201).json({
      success: true,
      data: activity
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get distinct countries
// @route   GET /api/leads/countries
// @access  Private
export const getCountries = async (req, res) => {
  try {
    const countries = await Lead.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('country')), 'country']],
      where: { country: { [Op.ne]: null } },
      order: [[sequelize.col('country'), 'ASC']],
      raw: true
    });

    const countryList = countries.map(c => c.country).filter(Boolean);

    res.status(200).json({ success: true, data: countryList });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get distinct products
// @route   GET /api/leads/products
// @access  Private
export const getProducts = async (req, res) => {
  try {
    const products = await Lead.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('product')), 'product']],
      where: { product: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] } },
      order: [[sequelize.col('product'), 'ASC']],
      raw: true
    });

    const productList = products.map(p => p.product).filter(Boolean);

    res.status(200).json({ success: true, data: productList });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete lead
// @route   DELETE /api/leads/:id
// @access  Private/Admin
export const deleteLead = async (req, res) => {
  try {
    const lead = req.lead || await Lead.findByPk(req.params.id);

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    const transaction = await sequelize.transaction();
    try {
      await Activity.destroy({ where: { leadId: lead.id }, transaction });
      await AssignmentHistory.destroy({ where: { leadId: lead.id }, transaction });
      await lead.destroy({ transaction });
      await transaction.commit();

      res.status(200).json({
        success: true,
        message: 'Lead deleted successfully'
      });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get stale leads (Fresh/RNR for 4+ days)
// @route   GET /api/leads/stale
// @access  Private/Admin
export const getStaleLeads = async (req, res) => {
  try {
    const effectiveBranch = req.effectiveBranch || (req.query.branch ? req.query.branch.toLowerCase() : null);
    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

    const where = {
      status: { [Op.in]: [LEAD_STATUS.FRESH, LEAD_STATUS.RNR] },
      createdAt: { [Op.lte]: fourDaysAgo }
    };

    if (effectiveBranch && effectiveBranch !== 'all') {
      where.branch = effectiveBranch;
    }

    const staleLeads = await Lead.findAll({
      where,
      include: [{
        model: User,
        as: 'salesperson',
        attributes: ['id', 'name', 'email']
      }],
      order: [['createdAt', 'ASC']]
    });

    res.status(200).json({
      success: true,
      count: staleLeads.length,
      data: staleLeads
    });
  } catch (error) {
    console.error('GetStaleLeads Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Redistribute stale leads (with transaction, AssignmentHistory, and cross-branch verification)
// @route   POST /api/leads/redistribute
// @access  Private/Admin
export const redistributeLeads = async (req, res) => {
  try {
    const { leadIds, branch, reason } = req.body;

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No leads selected for redistribution' });
    }

    const targetBranch = (req.effectiveBranch || branch || 'kochi').toLowerCase();

    const salespeople = await User.findAll({
      where: { role: 'salesperson', isActive: true, branch: targetBranch },
      attributes: ['id', 'name', 'branch']
    });

    if (salespeople.length === 0) {
      return res.status(400).json({
        success: false,
        message: `No active salespeople available in branch '${targetBranch}'`
      });
    }

    const leads = await Lead.findAll({
      where: {
        id: { [Op.in]: leadIds },
        branch: targetBranch
      }
    });

    if (leads.length === 0) {
      return res.status(404).json({ success: false, message: 'No matching leads found for redistribution in target branch' });
    }

    const transaction = await sequelize.transaction();
    try {
      const updatedLeads = [];
      for (let index = 0; index < leads.length; index++) {
        const lead = leads[index];
        const salesperson = salespeople[index % salespeople.length];
        const fromUserId = lead.assignedTo;

        await lead.update({
          assignedTo: salesperson.id,
          status: LEAD_STATUS.FRESH
        }, { transaction });

        // Record AssignmentHistory
        await AssignmentHistory.create({
          leadId: lead.id,
          fromUserId,
          toUserId: salesperson.id,
          assignedBy: req.user.id,
          assignedAt: new Date(),
          reason: reason || 'Stale lead redistribution'
        }, { transaction });

        // Record Activity
        await Activity.create({
          leadId: lead.id,
          userId: req.user.id,
          type: 'note',
          description: `Lead redistributed to ${salesperson.name}`
        }, { transaction });

        updatedLeads.push(lead);
      }

      await transaction.commit();

      res.status(200).json({
        success: true,
        message: `${updatedLeads.length} leads redistributed successfully`,
        data: updatedLeads
      });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Manually assign one or many leads to a salesperson (with cross-branch check & transaction)
// @route   POST /api/leads/assign
// @access  Private/Admin,Accountant
export const assignLeads = async (req, res) => {
  try {
    const { leadIds, assignTo, reason, forceReassign } = req.body;

    if (!assignTo) {
      return res.status(400).json({ success: false, message: 'assignTo (salesperson user id) is required' });
    }

    const newOwner = await User.findByPk(assignTo);
    if (!newOwner || newOwner.role !== 'salesperson' || !newOwner.isActive) {
      return res.status(400).json({ success: false, message: 'assignTo must be an active salesperson' });
    }

    const ids = Array.isArray(leadIds) ? leadIds : (leadIds ? [leadIds] : []);
    if (ids.length === 0) {
      return res.status(400).json({ success: false, message: 'leadIds array is required' });
    }

    const leads = await Lead.findAll({
      where: { id: { [Op.in]: ids } },
      include: [{ model: User, as: 'salesperson', attributes: ['id', 'name', 'email'] }]
    });

    if (!leads || leads.length === 0) {
      return res.status(404).json({ success: false, message: 'No matching leads found' });
    }

    // Check for conflict if not forceReassign and user is not admin
    if (!forceReassign && req.user.role !== 'admin') {
      const conflictingLead = leads.find(l => l.assignedTo && l.assignedTo !== newOwner.id);
      if (conflictingLead) {
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_ACTIVE_ASSIGNMENT',
          message: 'Lead is already actively assigned to another salesperson.',
          existingLeadId: conflictingLead.id,
          assignedTo: conflictingLead.salesperson ? {
            id: conflictingLead.salesperson.id,
            name: conflictingLead.salesperson.name,
            email: conflictingLead.salesperson.email
          } : null
        });
      }
    }

    const transaction = await sequelize.transaction();
    try {
      const now = new Date();
      for (const lead of leads) {
        const oldAssigneeId = lead.assignedTo;
        await lead.update({ assignedTo: newOwner.id, assignedAt: now }, { transaction });

        // Record AssignmentHistory
        await AssignmentHistory.create({
          leadId: lead.id,
          fromUserId: oldAssigneeId,
          toUserId: newOwner.id,
          assignedBy: req.user.id,
          assignedAt: now,
          reason: reason || (oldAssigneeId ? 'Force lead reassignment' : 'Initial assignment')
        }, { transaction });

        // Record Activity
        const actionDesc = oldAssigneeId && oldAssigneeId !== newOwner.id
          ? `Reassigned to ${newOwner.name}`
          : `Assigned to ${newOwner.name}`;

        await Activity.create({
          leadId: lead.id,
          userId: req.user.id,
          type: 'note',
          description: actionDesc
        }, { transaction });
      }

      await transaction.commit();

      const updated = await Lead.findAll({
        where: { id: { [Op.in]: ids } },
        include: [{ model: User, as: 'salesperson', attributes: ['id', 'name', 'email'] }]
      });

      return res.status(200).json({ success: true, count: updated.length, data: updated });
    } catch (assignErr) {
      await transaction.rollback();
      throw assignErr;
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Admin-only force reassign a lead to a new BDE
// @route   POST /api/leads/:id/force-reassign
// @access  Private/Admin
export const forceReassignLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignTo, reason } = req.body;

    if (!assignTo) {
      return res.status(400).json({ success: false, message: 'assignTo is required' });
    }

    const newOwner = await User.findByPk(assignTo);
    if (!newOwner || newOwner.role !== 'salesperson' || !newOwner.isActive) {
      return res.status(400).json({ success: false, message: 'assignTo must be an active salesperson' });
    }

    const lead = await Lead.findByPk(id);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    const oldAssigneeId = lead.assignedTo;
    const now = new Date();

    const transaction = await sequelize.transaction();
    try {
      await lead.update({ assignedTo: newOwner.id, assignedAt: now }, { transaction });

      await AssignmentHistory.create({
        leadId: lead.id,
        fromUserId: oldAssigneeId,
        toUserId: newOwner.id,
        assignedBy: req.user.id,
        assignedAt: now,
        reason: reason || 'Admin explicit force reassignment'
      }, { transaction });

      await Activity.create({
        leadId: lead.id,
        userId: req.user.id,
        type: 'note',
        description: `Explicit force reassignment to ${newOwner.name} by Admin`
      }, { transaction });

      await transaction.commit();

      const updated = await Lead.findByPk(lead.id, {
        include: [{ model: User, as: 'salesperson', attributes: ['id', 'name', 'email'] }]
      });

      return res.status(200).json({ success: true, message: 'Lead force-reassigned successfully', data: updated });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get unassigned leads for a branch
// @route   GET /api/leads/unassigned
// @access  Private/Admin
export const getUnassignedLeads = async (req, res) => {
  try {
    const effectiveBranch = req.effectiveBranch || (req.query.branch ? req.query.branch.toLowerCase() : null);

    const where = { assignedTo: null };
    if (effectiveBranch) {
      where.branch = effectiveBranch;
    }

    const unassignedLeads = await Lead.findAll({
      where,
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'name', 'email', 'phone', 'country', 'product', 'source', 'branch', 'createdAt']
    });

    res.status(200).json({
      success: true,
      count: unassignedLeads.length,
      data: unassignedLeads
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get deterministic BDE lead queue
// @route   GET /api/leads/queue
// @access  Private/Salesperson
export const getLeadQueue = async (req, res) => {
  try {
    const userId = req.user.id;
    const branch = (req.user.branch || '').toLowerCase();
    const { bucket = 'all' } = req.query;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const baseWhere = {
      assignedTo: userId,
      isDuplicate: false
    };
    if (branch) {
      baseWhere.branch = branch;
    }

    let leads = [];

    if (bucket === 'missed-followup') {
      leads = await Lead.findAll({
        where: {
          ...baseWhere,
          nextFollowUpAt: { [Op.lt]: now },
          status: { [Op.notIn]: [LEAD_STATUS.REGISTERED, LEAD_STATUS.DEAD, LEAD_STATUS.CANCELLED, LEAD_STATUS.REJECTED] }
        },
        order: [['nextFollowUpAt', 'ASC']]
      });
    } else if (bucket === 'followup-today') {
      leads = await Lead.findAll({
        where: {
          ...baseWhere,
          nextFollowUpAt: { [Op.gte]: startOfToday, [Op.lte]: endOfToday },
          status: { [Op.notIn]: [LEAD_STATUS.REGISTERED, LEAD_STATUS.DEAD, LEAD_STATUS.CANCELLED, LEAD_STATUS.REJECTED] }
        },
        order: [['nextFollowUpAt', 'ASC']]
      });
    } else if (bucket === 'fresh') {
      leads = await Lead.findAll({
        where: { ...baseWhere, status: LEAD_STATUS.FRESH },
        order: [['createdAt', 'DESC']]
      });
    } else {
      // Deterministic Priority: Overdue -> Due Today -> Fresh -> Rest
      const missed = await Lead.findAll({
        where: {
          ...baseWhere,
          nextFollowUpAt: { [Op.lt]: now },
          status: { [Op.notIn]: [LEAD_STATUS.REGISTERED, LEAD_STATUS.DEAD, LEAD_STATUS.CANCELLED, LEAD_STATUS.REJECTED] }
        },
        order: [['nextFollowUpAt', 'ASC']]
      });

      const today = await Lead.findAll({
        where: {
          ...baseWhere,
          nextFollowUpAt: { [Op.gte]: startOfToday, [Op.lte]: endOfToday },
          status: { [Op.notIn]: [LEAD_STATUS.REGISTERED, LEAD_STATUS.DEAD, LEAD_STATUS.CANCELLED, LEAD_STATUS.REJECTED] }
        },
        order: [['nextFollowUpAt', 'ASC']]
      });

      const fresh = await Lead.findAll({
        where: { ...baseWhere, status: LEAD_STATUS.FRESH },
        order: [['createdAt', 'DESC']]
      });

      const rest = await Lead.findAll({
        where: {
          ...baseWhere,
          status: { [Op.notIn]: [LEAD_STATUS.FRESH, LEAD_STATUS.REGISTERED, LEAD_STATUS.DEAD, LEAD_STATUS.CANCELLED, LEAD_STATUS.REJECTED] },
          [Op.or]: [
            { nextFollowUpAt: null },
            { nextFollowUpAt: { [Op.gt]: endOfToday } }
          ]
        },
        order: [['assignedAt', 'DESC'], ['updatedAt', 'DESC']]
      });

      const seenIds = new Set();
      leads = [...missed, ...today, ...fresh, ...rest].filter(l => {
        if (seenIds.has(l.id)) return false;
        seenIds.add(l.id);
        return true;
      });
    }

    const missedCount = await Lead.count({
      where: {
        ...baseWhere,
        nextFollowUpAt: { [Op.lt]: now },
        status: { [Op.notIn]: [LEAD_STATUS.REGISTERED, LEAD_STATUS.DEAD, LEAD_STATUS.CANCELLED, LEAD_STATUS.REJECTED] }
      }
    });

    const todayCount = await Lead.count({
      where: {
        ...baseWhere,
        nextFollowUpAt: { [Op.gte]: startOfToday, [Op.lte]: endOfToday },
        status: { [Op.notIn]: [LEAD_STATUS.REGISTERED, LEAD_STATUS.DEAD, LEAD_STATUS.CANCELLED, LEAD_STATUS.REJECTED] }
      }
    });

    const freshCount = await Lead.count({
      where: { ...baseWhere, status: LEAD_STATUS.FRESH }
    });

    res.status(200).json({
      success: true,
      count: leads.length,
      data: leads,
      queueSummary: {
        missedCount,
        todayCount,
        freshCount,
        totalQueueCount: leads.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark lead as duplicate
// @route   POST /api/leads/:id/mark-duplicate
// @access  Private
export const markDuplicate = async (req, res) => {
  try {
    const { id } = req.params;
    const { primaryLeadId, notes } = req.body;

    const lead = await Lead.findByPk(id);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }

    lead.isDuplicate = true;
    lead.duplicateOfLeadId = primaryLeadId || null;
    await lead.save();

    await Activity.create({
      leadId: lead.id,
      userId: req.user.id,
      type: 'note',
      description: `Marked as Duplicate. ${primaryLeadId ? `Primary Lead ID: ${primaryLeadId}.` : ''} ${notes || ''}`
    });

    res.status(200).json({
      success: true,
      message: 'Lead marked as Duplicate.',
      data: lead
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

