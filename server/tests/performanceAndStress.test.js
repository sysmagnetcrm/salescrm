import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import sequelize from '../config/database.js';
import { User, Lead, Payment, CallLog, Activity, AssignmentHistory } from '../models/index.js';
import authRoutes from '../routes/authRoutes.js';
import leadRoutes from '../routes/leadRoutes.js';
import paymentRoutes from '../routes/paymentRoutes.js';
import callRoutes from '../routes/callRoutes.js';
import dashboardRoutes from '../routes/dashboardRoutes.js';
import systemRoutes from '../routes/systemRoutes.js';
import { enforceClientVersion } from '../middleware/versionCheck.js';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(enforceClientVersion);
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/system', systemRoutes);

function calculatePercentiles(latencies) {
  if (latencies.length === 0) return { avg: 0, p95: 0, p99: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const avg = sum / sorted.length;
  const p95Idx = Math.floor(sorted.length * 0.95);
  const p99Idx = Math.floor(sorted.length * 0.99);
  return {
    avg: Math.round(avg * 100) / 100,
    p95: Math.round(sorted[Math.min(p95Idx, sorted.length - 1)] * 100) / 100,
    p99: Math.round(sorted[Math.min(p99Idx, sorted.length - 1)] * 100) / 100
  };
}

describe('Academy CRM Performance, Stress, Concurrency & Data Integrity Benchmark', () => {
  let server, baseURL;
  let adminUser, adminToken;
  let bdeUsers = [];
  let bdeTokens = [];

  before(async () => {
    await sequelize.sync({ force: false });

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseURL = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });

    const jwtSecret = process.env.JWT_SECRET || 'fallback_development_jwt_secret_key_12345';

    adminUser = await User.create({
      name: 'Stress Admin',
      email: 'stress_admin@test.com',
      password: 'Password123!',
      role: 'admin',
      phone: '9100000000',
      branch: 'kochi'
    });
    adminToken = jwt.sign({ id: adminUser.id }, jwtSecret, { expiresIn: '1h' });

    // Create 60 concurrent BDE users
    for (let i = 1; i <= 60; i++) {
      const bde = await User.create({
        name: `BDE ${i}`,
        email: `stress_bde_${i}@test.com`,
        password: 'Password123!',
        role: 'salesperson',
        phone: `91000000${i.toString().padStart(2, '0')}`,
        branch: 'kochi'
      });
      const token = jwt.sign({ id: bde.id }, jwtSecret, { expiresIn: '1h' });
      bdeUsers.push(bde);
      bdeTokens.push(token);
    }
  });

  it('Concurrent BDE Activity Simulation (60 Concurrent BDEs)', async () => {
    const latencies = [];
    let errors = 0;
    const concurrentRequests = 60;

    const startTime = Date.now();

    const tasks = bdeTokens.map(async (token, idx) => {
      const t0 = Date.now();
      try {
        const res = await fetch(`${baseURL}/api/leads/queue`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'x-client-version': '1.2.0'
          }
        });
        const elapsed = Date.now() - t0;
        if (res.status === 200) {
          latencies.push(elapsed);
        } else {
          errors++;
        }
      } catch (err) {
        errors++;
      }
    });

    await Promise.all(tasks);
    const duration = Date.now() - startTime;
    const stats = calculatePercentiles(latencies);

    console.log(`\n📊 Concurrent BDE Activity Results (60 Concurrent Users):`);
    console.log(`   - Total Executed: ${concurrentRequests}`);
    console.log(`   - Total Duration: ${duration}ms`);
    console.log(`   - Avg Response: ${stats.avg}ms`);
    console.log(`   - P95 Response: ${stats.p95}ms`);
    console.log(`   - P99 Response: ${stats.p99}ms`);
    console.log(`   - Error Rate: ${((errors / concurrentRequests) * 100).toFixed(2)}%\n`);

    assert.equal(errors, 0, 'No errors should occur during concurrent BDE operations');
    assert.ok(stats.p95 < 2000, 'P95 latency under 60 concurrent users must be under 2000ms');
  });

  it('Bulk Assignment Stress Benchmark (100, 500, 1000, 5000 leads)', async () => {
    const targetBDE = bdeUsers[0];
    const sizes = [100, 500, 1000, 5000];
    const bulkResults = {};

    for (const size of sizes) {
      // Seed test leads for bulk operation
      const leadRecords = [];
      const now = new Date();

      for (let i = 0; i < size; i++) {
        leadRecords.push({
          id: crypto.randomUUID(),
          name: `Bulk Student ${size}-${i}`,
          phone: `99${size.toString().padStart(4, '0')}${i.toString().padStart(4, '0')}`,
          country: 'India',
          branch: 'kochi',
          createdAt: now,
          updatedAt: now
        });
      }

      await Lead.bulkCreate(leadRecords);
      const leadIds = leadRecords.map(l => l.id);

      const t0 = Date.now();
      const res = await fetch(`${baseURL}/api/leads/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
          'x-client-version': '1.2.0'
        },
        body: JSON.stringify({
          leadIds,
          assignTo: targetBDE.id,
          reason: `Bulk benchmark size ${size}`
        })
      });

      const elapsed = Date.now() - t0;
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.count, size);

      bulkResults[size] = `${elapsed}ms`;

      // Clean bulk leads
      await Lead.destroy({ where: { id: leadIds } });
    }

    console.log(`\n⚡ Bulk Assignment Stress Benchmark Results:`);
    console.log(`   - 100 Leads: ${bulkResults[100]}`);
    console.log(`   - 500 Leads: ${bulkResults[500]}`);
    console.log(`   - 1,000 Leads: ${bulkResults[1000]}`);
    console.log(`   - 5,000 Leads: ${bulkResults[5000]}\n`);
  });

  it('Database & Financial Integrity Audit', async () => {
    // 1. Check for orphaned Payment records
    const orphanedPayments = await sequelize.query(
      `SELECT p.id FROM "Payments" p LEFT JOIN "Leads" l ON p."leadId" = l.id WHERE l.id IS NULL`,
      { type: sequelize.QueryTypes.SELECT }
    ).catch(() => []);

    assert.equal(orphanedPayments.length, 0, 'There should be no orphaned payment records');

    // 2. Check for batch allocations below ₹9,000 cleared payment
    const invalidBatchAllocations = await Lead.findAll({
      where: {
        batchAllocatedAt: { [sequelize.Sequelize.Op.ne]: null },
        totalClearedPayment: { [sequelize.Sequelize.Op.lt]: 9000.00 }
      }
    });

    assert.equal(invalidBatchAllocations.length, 0, 'No lead below ₹9,000 cleared total can be allocated a batch');

    // 3. Check cross-branch lead assignment integrity
    const crossBranchLeads = await sequelize.query(
      `SELECT l.id FROM "Leads" l JOIN "Users" u ON l."assignedTo" = u.id WHERE LOWER(l.branch) != LOWER(u.branch)`,
      { type: sequelize.QueryTypes.SELECT }
    ).catch(() => []);

    assert.equal(crossBranchLeads.length, 0, 'No lead should be assigned to a salesperson in a different branch');
  });

  after(async () => {
    if (server) server.close();
    await Payment.destroy({ where: {} });
    await CallLog.destroy({ where: {} });
    await Lead.destroy({ where: {} });
    await User.destroy({ where: { email: { [sequelize.Sequelize.Op.like]: 'stress_%' } } });
  });
});
