import { Payment, Lead, Activity } from '../models/index.js';
import sequelize from '../config/database.js';

// @desc    Record structured payment (Admission ₹1,000 / Orientation ₹8,000 / Installments)
// @route   POST /api/payments
// @access  Private
export const recordPayment = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { leadId, paymentType, amount, paymentDate, referenceId, notes } = req.body;

    if (!leadId || !paymentType || amount === undefined || amount === null) {
      await transaction.rollback();
      return res.status(422).json({
        success: false,
        message: 'Lead ID, payment type, and non-negative amount are required.'
      });
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || !isFinite(numericAmount) || numericAmount <= 0) {
      await transaction.rollback();
      return res.status(422).json({
        success: false,
        message: 'Payment amount must be a positive finite number.'
      });
    }

    const lead = await Lead.findByPk(leadId, { transaction });
    if (!lead) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }

    // Branch Authorization check for salespeople
    if (req.user.role === 'salesperson' && lead.assignedTo !== req.user.id) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Forbidden: Access to another branch lead denied.' });
    }

    // Create payment record
    const payment = await Payment.create({
      leadId,
      paymentType,
      amount: numericAmount,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      paymentStatus: 'cleared',
      referenceId: referenceId ? String(referenceId).trim() : null,
      recordedBy: req.user.id,
      notes: notes ? String(notes).trim() : null
    }, { transaction });

    // Aggregate total cleared payments for this lead
    const allClearedPayments = await Payment.findAll({
      where: { leadId, paymentStatus: 'cleared' },
      transaction
    });

    let admissionTotal = 0;
    let orientationTotal = 0;
    let totalCleared = 0;

    allClearedPayments.forEach(p => {
      const pAmt = parseFloat(p.amount) || 0;
      totalCleared += pAmt;
      if (p.paymentType === 'admission') admissionTotal += pAmt;
      if (p.paymentType === 'orientation') orientationTotal += pAmt;
    });

    lead.totalClearedPayment = totalCleared;
    lead.value = totalCleared;

    if (admissionTotal >= 1000) {
      lead.admissionFeeStatus = 'cleared';
    }
    lead.admissionFeeAmount = admissionTotal;

    if (orientationTotal >= 8000) {
      lead.orientationFeeStatus = 'cleared';
    } else if (orientationTotal > 0) {
      lead.orientationFeeStatus = 'partial';
    }
    lead.orientationFeeAmount = orientationTotal;

    // Strict Backend Lock: Batch allocation eligibility requires total cleared payment >= ₹9,000
    if (totalCleared >= 9000.00) {
      lead.batchAllocationEligible = true;
    }

    await lead.save({ transaction });

    // Create Activity Log
    await Activity.create({
      leadId,
      userId: req.user.id,
      type: 'note',
      description: `Recorded ${paymentType} payment of ₹${numericAmount.toFixed(2)} (Total Cleared: ₹${totalCleared.toFixed(2)})`
    }, { transaction });

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: `Payment of ₹${numericAmount.toFixed(2)} recorded successfully. Total Cleared: ₹${totalCleared.toFixed(2)}`,
      data: {
        payment,
        leadSummary: {
          totalClearedPayment: lead.totalClearedPayment,
          admissionFeeStatus: lead.admissionFeeStatus,
          orientationFeeStatus: lead.orientationFeeStatus,
          batchAllocationEligible: lead.batchAllocationEligible
        }
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('RecordPayment Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get payment history for a lead
// @route   GET /api/payments/lead/:leadId
// @access  Private
export const getLeadPayments = async (req, res) => {
  try {
    const { leadId } = req.params;
    const lead = await Lead.findByPk(leadId);

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }

    if (req.user.role === 'salesperson' && lead.assignedTo !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Forbidden: Access to another branch lead denied.' });
    }

    const payments = await Payment.findAll({
      where: { leadId },
      order: [['paymentDate', 'DESC']]
    });

    res.status(200).json({
      success: true,
      data: payments,
      summary: {
        totalClearedPayment: lead.totalClearedPayment,
        admissionFeeStatus: lead.admissionFeeStatus,
        admissionFeeAmount: lead.admissionFeeAmount,
        orientationFeeStatus: lead.orientationFeeStatus,
        orientationFeeAmount: lead.orientationFeeAmount,
        batchAllocationEligible: lead.batchAllocationEligible,
        batchAllocatedAt: lead.batchAllocatedAt
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Allocate batch for lead (requires ₹9,000 total cleared payment)
// @route   POST /api/payments/allocate-batch
// @access  Private (Admin / TL)
export const allocateBatch = async (req, res) => {
  try {
    const { leadId, notes } = req.body;
    const lead = await Lead.findByPk(leadId);

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }

    // Backend Lock Enforcement: Reject if payment is less than ₹9,000
    const totalCleared = parseFloat(lead.totalClearedPayment) || 0;
    if (totalCleared < 9000.00 || !lead.batchAllocationEligible) {
      return res.status(400).json({
        success: false,
        message: `Cannot allocate batch. Total cleared payment is ₹${totalCleared.toFixed(2)} (Minimum required is ₹9,000.00).`
      });
    }

    lead.batchAllocatedAt = new Date();
    lead.status = 'registered';
    lead.closedAt = new Date();
    await lead.save();

    await Activity.create({
      leadId,
      userId: req.user.id,
      type: 'status_change',
      oldStatus: lead.status,
      newStatus: 'registered',
      description: `Batch allocated by ${req.user.name}. ${notes || ''}`
    });

    res.status(200).json({
      success: true,
      message: 'Batch allocated successfully. Lead marked as Registered.',
      data: lead
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
