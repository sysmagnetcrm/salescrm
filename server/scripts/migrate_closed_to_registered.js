import sequelize from '../config/database.js';

export const runClosedToRegisteredMigration = async () => {
  try {
    console.log('🔍 Starting audit of "closed" status in database...');

    // 1. Audit Leads count with 'closed'
    const [leadAudit] = await sequelize.query(
      `SELECT COUNT(*) as count FROM "Leads" WHERE status = 'closed'`
    ).catch(async () => {
      // Fallback for dialect casing
      return await sequelize.query(`SELECT COUNT(*) as count FROM Leads WHERE status = 'closed'`);
    });

    const leadClosedCount = parseInt(leadAudit[0]?.count || leadAudit[0]?.COUNT || 0);

    // 2. Audit Activities with 'closed' in oldStatus or newStatus
    const [actOldAudit] = await sequelize.query(
      `SELECT COUNT(*) as count FROM "Activities" WHERE "oldStatus" = 'closed' OR "newStatus" = 'closed'`
    ).catch(async () => {
      return await sequelize.query(`SELECT COUNT(*) as count FROM Activities WHERE oldStatus = 'closed' OR newStatus = 'closed'`);
    });

    const actClosedCount = parseInt(actOldAudit[0]?.count || actOldAudit[0]?.COUNT || 0);

    console.log(`📊 Audit Results: Found ${leadClosedCount} Leads and ${actClosedCount} Activities with status 'closed'.`);

    if (leadClosedCount === 0 && actClosedCount === 0) {
      console.log('✅ Data Migration Audit: No legacy "closed" status records found. Database is clean.');
      return { leadMigrated: 0, activityMigrated: 0 };
    }

    // 3. Execute idempotent migration inside transaction
    const transaction = await sequelize.transaction();
    try {
      // Update Leads
      const [leadResult] = await sequelize.query(
        `UPDATE "Leads" SET status = 'registered' WHERE status = 'closed'`,
        { transaction }
      ).catch(async () => {
        return await sequelize.query(`UPDATE Leads SET status = 'registered' WHERE status = 'closed'`, { transaction });
      });

      // Update Activities oldStatus
      await sequelize.query(
        `UPDATE "Activities" SET "oldStatus" = 'registered' WHERE "oldStatus" = 'closed'`,
        { transaction }
      ).catch(async () => {
        return await sequelize.query(`UPDATE Activities SET oldStatus = 'registered' WHERE oldStatus = 'closed'`, { transaction });
      });

      // Update Activities newStatus
      await sequelize.query(
        `UPDATE "Activities" SET "newStatus" = 'registered' WHERE "newStatus" = 'closed'`,
        { transaction }
      ).catch(async () => {
        return await sequelize.query(`UPDATE Activities SET newStatus = 'registered' WHERE newStatus = 'closed'`, { transaction });
      });

      // Update Statuses master table if value = 'closed'
      await sequelize.query(
        `UPDATE "Statuses" SET value = 'registered' WHERE value = 'closed'`,
        { transaction }
      ).catch(async () => {
        return await sequelize.query(`UPDATE Statuses SET value = 'registered' WHERE value = 'closed'`, { transaction });
      });

      await transaction.commit();

      console.log(`🎉 Migration Completed Successfully! Migrated ${leadClosedCount} Leads and ${actClosedCount} Activities from 'closed' -> 'registered'.`);
      return { leadMigrated: leadClosedCount, activityMigrated: actClosedCount };
    } catch (err) {
      await transaction.rollback();
      console.error('❌ Migration failed and rolled back:', err);
      throw err;
    }
  } catch (error) {
    console.error('Error executing closed->registered migration:', error);
    return { error: error.message };
  }
};
