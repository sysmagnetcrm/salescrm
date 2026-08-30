import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import sequelize from '../config/database.js';
import { User, Lead, Payment, CallLog, Activity, AssignmentHistory } from '../models/index.js';
import authRoutes from '../routes/authRoutes.js';
import leadRoutes from '../routes/leadRoutes.js';
import paymentRoutes from '../routes/paymentRoutes.js';
import callRoutes from '../routes/callRoutes.js';
import systemRoutes from '../routes/systemRoutes.js';
import { enforceClientVersion } from '../middleware/versionCheck.js';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json());
app.use(enforceClientVersion);
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/system', systemRoutes);

describe('Academy Sales CRM Workflow Test Suite', () => {
  let server, baseURL;
  let adminToken, bde1Token, tlToken;
  let adminUser, bde1User, tlUser;
  let testLead;

  before(async () => {
    await sequelize.sync({ force: true });

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseURL = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });

    // Clean test data
    await Payment.destroy({ where: {} });
    await CallLog.destroy({ where: {} });
    await Lead.destroy({ where: {} });
    await User.destroy({ where: { email: { [sequelize.Sequelize.Op.like]: 'academy_%' } } });

    // Create test accounts
    adminUser = await User.create({
      name: 'Academy Admin',
      email: 'academy_admin@test.com',
      password: 'Password123!',
      role: 'admin',
      phone: '9000000001',
      branch: 'kochi'
    });

    bde1User = await User.create({
      name: 'Academy BDE One',
      email: 'academy_bde1@test.com',
      password: 'Password123!',
      role: 'salesperson',
      phone: '9000000002',
      branch: 'kochi'
    });

    tlUser = await User.create({
      name: 'Academy Team Leader',
      email: 'academy_tl@test.com',
      password: 'Password123!',
      role: 'admin',
      phone: '9000000003',
      branch: 'kochi'
    });

    const jwtSecret = process.env.JWT_SECRET || 'fallback_development_jwt_secret_key_12345';
    adminToken = jwt.sign({ id: adminUser.id }, jwtSecret, { expiresIn: '1h' });
    bde1Token = jwt.sign({ id: bde1User.id }, jwtSecret, { expiresIn: '1h' });
    tlToken = jwt.sign({ id: tlUser.id }, jwtSecret, { expiresIn: '1h' });

    testLead = await Lead.create({
      name: 'Rahul Academy Student',
      phone: '9876543210',
      email: 'rahul@student.test',
      country: 'India',
      campus: 'Kochi',
      branch: 'kochi',
      assignedTo: bde1User.id,
      assignedAt: new Date()
    });
  });

  it('System Version API returns valid client compatibility payload', async () => {
    const res = await fetch(`${baseURL}/api/system/version`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(typeof body.data.currentVersion, 'string');
    assert.equal(typeof body.data.minSupportedVersion, 'string');
  });

  it('Obsolete client version (x-client-version: 0.9.0) is rejected with 426 Upgrade Required', async () => {
    const res = await fetch(`${baseURL}/api/leads/queue`, {
      headers: {
        Authorization: `Bearer ${bde1Token}`,
        'x-client-version': '0.9.0'
      }
    });

    assert.equal(res.status, 426);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.code, 'CLIENT_VERSION_OBSOLETE');
  });

  it('Supported client version (x-client-version: 1.2.0) is allowed', async () => {
    const res = await fetch(`${baseURL}/api/leads/queue`, {
      headers: {
        Authorization: `Bearer ${bde1Token}`,
        'x-client-version': '1.2.0'
      }
    });

    assert.equal(res.status, 200);
  });

  it('BDE Queue returns leads sorted deterministically with missed follow-ups prioritized', async () => {
    const pastDate = new Date(Date.now() - 3600000 * 24); // 1 day ago
    const overdueLead = await Lead.create({
      name: 'Overdue Lead',
      phone: '9876543211',
      country: 'India',
      branch: 'kochi',
      assignedTo: bde1User.id,
      nextFollowUpAt: pastDate,
      status: 'follow-up'
    });

    const res = await fetch(`${baseURL}/api/leads/queue`, {
      headers: { Authorization: `Bearer ${bde1Token}` }
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.length >= 2);
    assert.equal(body.data[0].id, overdueLead.id);
  });

  it('Structured Payments & Strict ₹9,000 Batch Allocation Backend Lock', async () => {
    const pay1 = await fetch(`${baseURL}/api/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bde1Token}`
      },
      body: JSON.stringify({
        leadId: testLead.id,
        paymentType: 'admission',
        amount: 1000,
        referenceId: 'REF-ADM-100'
      })
    });

    assert.equal(pay1.status, 201);
    const pay1Body = await pay1.json();
    assert.equal(pay1Body.data.leadSummary.admissionFeeStatus, 'cleared');
    assert.equal(pay1Body.data.leadSummary.totalClearedPayment, 1000);
    assert.equal(pay1Body.data.leadSummary.batchAllocationEligible, false);

    const allocFail = await fetch(`${baseURL}/api/payments/allocate-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ leadId: testLead.id })
    });

    assert.equal(allocFail.status, 400);
    const allocFailBody = await allocFail.json();
    assert.match(allocFailBody.message, /Minimum required is ₹9,000/);

    const pay2 = await fetch(`${baseURL}/api/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bde1Token}`
      },
      body: JSON.stringify({
        leadId: testLead.id,
        paymentType: 'orientation',
        amount: 4000,
        referenceId: 'REF-ORI-001'
      })
    });

    assert.equal(pay2.status, 201);
    const pay2Body = await pay2.json();
    assert.equal(pay2Body.data.leadSummary.orientationFeeStatus, 'partial');
    assert.equal(pay2Body.data.leadSummary.totalClearedPayment, 5000);

    const pay3 = await fetch(`${baseURL}/api/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bde1Token}`
      },
      body: JSON.stringify({
        leadId: testLead.id,
        paymentType: 'orientation',
        amount: 4000,
        referenceId: 'REF-ORI-002'
      })
    });

    assert.equal(pay3.status, 201);
    const pay3Body = await pay3.json();
    assert.equal(pay3Body.data.leadSummary.orientationFeeStatus, 'cleared');
    assert.equal(pay3Body.data.leadSummary.totalClearedPayment, 9000);
    assert.equal(pay3Body.data.leadSummary.batchAllocationEligible, true);

    const allocSuccess = await fetch(`${baseURL}/api/payments/allocate-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ leadId: testLead.id, notes: 'Allocated to Batch A1' })
    });

    assert.equal(allocSuccess.status, 200);
    const allocSuccessBody = await allocSuccess.json();
    assert.equal(allocSuccessBody.data.status, 'registered');
    assert.ok(allocSuccessBody.data.batchAllocatedAt);
  });

  it('TL calling on behalf of BDE records callerUserId (TL) and leadOwnerId (BDE)', async () => {
    const callRes = await fetch(`${baseURL}/api/calls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tlToken}`
      },
      body: JSON.stringify({
        leadId: testLead.id,
        callDirection: 'outbound',
        callStatus: 'initiated',
        phoneNumber: testLead.phone
      })
    });

    assert.equal(callRes.status, 201);
    const callBody = await callRes.json();
    const callId = callBody.data.id;
    assert.equal(callBody.data.leadOwnerId, bde1User.id);
    assert.equal(callBody.data.callerUserId, tlUser.id);

    const completeRes = await fetch(`${baseURL}/api/calls/${callId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tlToken}`
      },
      body: JSON.stringify({
        callStatus: 'completed',
        disposition: 'interested',
        notes: 'TL discussed batch timings'
      })
    });

    assert.equal(completeRes.status, 200);
    const completeBody = await completeRes.json();
    assert.equal(completeBody.data.callStatus, 'completed');
  });

  it('Call duration calculation audit: Call that rings for 30s then talks for 120s', async () => {
    const t0 = new Date('2026-08-28T10:00:00.000Z');
    const tRinging = new Date('2026-08-28T10:00:05.000Z');
    const tConnected = new Date('2026-08-28T10:00:30.000Z'); // 30s ringing
    const tEnded = new Date('2026-08-28T10:02:30.000Z');    // 120s talk time after connected

    // Initiate call
    const initRes = await fetch(`${baseURL}/api/calls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bde1Token}`
      },
      body: JSON.stringify({
        leadId: testLead.id,
        startedAt: t0.toISOString(),
        callStatus: 'initiated'
      })
    });

    assert.equal(initRes.status, 201);
    const callId = (await initRes.json()).data.id;

    // Transition to Ringing
    await fetch(`${baseURL}/api/calls/${callId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bde1Token}` },
      body: JSON.stringify({ callStatus: 'ringing', ringingAt: tRinging.toISOString() })
    });

    // Transition to Connected
    await fetch(`${baseURL}/api/calls/${callId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bde1Token}` },
      body: JSON.stringify({ callStatus: 'connected', connectedAt: tConnected.toISOString() })
    });

    // Complete Call
    const finishRes = await fetch(`${baseURL}/api/calls/${callId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bde1Token}` },
      body: JSON.stringify({
        callStatus: 'completed',
        endedAt: tEnded.toISOString(),
        disposition: 'interested',
        providerDurationSeconds: 120
      })
    });

    assert.equal(finishRes.status, 200);
    const callData = (await finishRes.json()).data;

    // Actual talk time must equal endedAt - connectedAt (120 seconds)
    assert.equal(callData.durationSeconds, 120);
    // Lifecycle duration must equal endedAt - startedAt (150 seconds)
    assert.equal(callData.lifecycleDurationSeconds, 150);
    // Provider reported duration must be preserved separately
    assert.equal(callData.providerDurationSeconds, 120);
  });

  it('Call duration calculation audit: No-Answer call (rings for 45s, 0s talk time)', async () => {
    const t0 = new Date('2026-08-28T10:10:00.000Z');
    const tEnded = new Date('2026-08-28T10:10:45.000Z');

    const initRes = await fetch(`${baseURL}/api/calls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bde1Token}`
      },
      body: JSON.stringify({
        leadId: testLead.id,
        startedAt: t0.toISOString(),
        callStatus: 'initiated'
      })
    });

    const callId = (await initRes.json()).data.id;

    const finishRes = await fetch(`${baseURL}/api/calls/${callId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bde1Token}` },
      body: JSON.stringify({
        callStatus: 'no-answer',
        endedAt: tEnded.toISOString(),
        disposition: 'rnr'
      })
    });

    assert.equal(finishRes.status, 200);
    const callData = (await finishRes.json()).data;

    // Talk time for call that never connected must be 0
    assert.equal(callData.durationSeconds, 0);
    assert.equal(callData.lifecycleDurationSeconds, 45);
  });

  it('Call duration calculation audit: Failed call (0s talk time)', async () => {
    const t0 = new Date('2026-08-28T10:20:00.000Z');
    const tEnded = new Date('2026-08-28T10:20:10.000Z');

    const initRes = await fetch(`${baseURL}/api/calls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bde1Token}`
      },
      body: JSON.stringify({
        leadId: testLead.id,
        startedAt: t0.toISOString(),
        callStatus: 'initiated'
      })
    });

    const callId = (await initRes.json()).data.id;

    const finishRes = await fetch(`${baseURL}/api/calls/${callId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bde1Token}` },
      body: JSON.stringify({
        callStatus: 'failed',
        endedAt: tEnded.toISOString()
      })
    });

    assert.equal(finishRes.status, 200);
    const callData = (await finishRes.json()).data;

    assert.equal(callData.durationSeconds, 0);
    assert.equal(callData.lifecycleDurationSeconds, 10);
  });

  it('Call duration calculation audit: Cancelled call (0s talk time)', async () => {
    const t0 = new Date('2026-08-28T10:30:00.000Z');
    const tEnded = new Date('2026-08-28T10:30:05.000Z');

    const initRes = await fetch(`${baseURL}/api/calls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bde1Token}`
      },
      body: JSON.stringify({
        leadId: testLead.id,
        startedAt: t0.toISOString(),
        callStatus: 'initiated'
      })
    });

    const callId = (await initRes.json()).data.id;

    const finishRes = await fetch(`${baseURL}/api/calls/${callId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bde1Token}` },
      body: JSON.stringify({
        callStatus: 'cancelled',
        endedAt: tEnded.toISOString()
      })
    });

    assert.equal(finishRes.status, 200);
    const callData = (await finishRes.json()).data;

    assert.equal(callData.durationSeconds, 0);
    assert.equal(callData.lifecycleDurationSeconds, 5);
  });

  it('Marking lead as duplicate sets isDuplicate = true', async () => {
    const dupRes = await fetch(`${baseURL}/api/leads/${testLead.id}/mark-duplicate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bde1Token}`
      },
      body: JSON.stringify({ notes: 'Verified duplicate phone number' })
    });

    assert.equal(dupRes.status, 200);
    const dupBody = await dupRes.json();
    assert.equal(dupBody.data.isDuplicate, true);
  });

  it('ITEM 1: Duplicate phone creation attempt returns 409 Conflict with existing owner details', async () => {
    const dupPhoneRes = await fetch(`${baseURL}/api/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
        'x-client-version': '1.2.0'
      },
      body: JSON.stringify({
        name: 'Duplicate Student',
        phone: '9876543210',
        country: 'India',
        assignedTo: bde1User.id
      })
    });

    assert.equal(dupPhoneRes.status, 409);
    const body = await dupPhoneRes.json();
    assert.equal(body.success, false);
    assert.equal(body.code, 'DUPLICATE_ACTIVE_ASSIGNMENT');
    assert.equal(body.existingLeadId, testLead.id);
    assert.equal(body.assignedTo.id, bde1User.id);
  });

  it('ITEM 1: Admin explicit force-reassign transfers ownership and records AssignmentHistory', async () => {
    const forceRes = await fetch(`${baseURL}/api/leads/${testLead.id}/force-reassign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
        'x-client-version': '1.2.0'
      },
      body: JSON.stringify({
        assignTo: bde1User.id,
        reason: 'Admin resolved conflict'
      })
    });

    assert.equal(forceRes.status, 200);
    const body = await forceRes.json();
    assert.equal(body.success, true);
    assert.equal(body.data.assignedTo, bde1User.id);
  });

  it('ITEM 2: Status transitions to admission-done, orientation-done, and registered rejected without required payments', async () => {
    const freshLead = await Lead.create({
      name: 'Status Test Lead',
      phone: '9111222333',
      country: 'India',
      branch: 'kochi',
      assignedTo: bde1User.id
    });

    // 1. Try setting status to admission-done without payment -> expect 400
    const resAdm = await fetch(`${baseURL}/api/leads/${freshLead.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bde1Token}`, 'x-client-version': '1.2.0' },
      body: JSON.stringify({ status: 'admission-done' })
    });
    assert.equal(resAdm.status, 400);
    const bodyAdm = await resAdm.json();
    assert.equal(bodyAdm.success, false);
    assert.match(bodyAdm.message, /Admission Done/);

    // 2. Try setting status to orientation-done without payment -> expect 400
    const resOri = await fetch(`${baseURL}/api/leads/${freshLead.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bde1Token}`, 'x-client-version': '1.2.0' },
      body: JSON.stringify({ status: 'orientation-done' })
    });
    assert.equal(resOri.status, 400);
    const bodyOri = await resOri.json();
    assert.equal(bodyOri.success, false);
    assert.match(bodyOri.message, /Orientation Done/);

    // 3. Try setting status to registered without payment -> expect 400
    const resReg = await fetch(`${baseURL}/api/leads/${freshLead.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bde1Token}`, 'x-client-version': '1.2.0' },
      body: JSON.stringify({ status: 'registered' })
    });
    assert.equal(resReg.status, 400);
    const bodyReg = await resReg.json();
    assert.equal(bodyReg.success, false);
    assert.match(bodyReg.message, /Registered \/ Batch Allocated/);

    // 4. Record ₹1,000 admission payment
    await fetch(`${baseURL}/api/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bde1Token}`, 'x-client-version': '1.2.0' },
      body: JSON.stringify({
        leadId: freshLead.id,
        paymentType: 'admission',
        amount: 1000
      })
    });

    // Re-attempt admission-done -> should succeed
    const passAdm = await fetch(`${baseURL}/api/leads/${freshLead.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bde1Token}`, 'x-client-version': '1.2.0' },
      body: JSON.stringify({ status: 'admission-done' })
    });
    assert.equal(passAdm.status, 200);
    assert.equal((await passAdm.json()).data.status, 'admission-done');

    // 5. Record ₹8,000 orientation payment (Total cleared: ₹9,000)
    await fetch(`${baseURL}/api/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bde1Token}`, 'x-client-version': '1.2.0' },
      body: JSON.stringify({
        leadId: freshLead.id,
        paymentType: 'orientation',
        amount: 8000
      })
    });

    // Re-attempt orientation-done -> should succeed
    const passOri = await fetch(`${baseURL}/api/leads/${freshLead.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bde1Token}`, 'x-client-version': '1.2.0' },
      body: JSON.stringify({ status: 'orientation-done' })
    });
    assert.equal(passOri.status, 200);
    assert.equal((await passOri.json()).data.status, 'orientation-done');

    // Re-attempt registered -> should succeed now that total cleared >= 9000 & batchAllocationEligible === true
    const passReg = await fetch(`${baseURL}/api/leads/${freshLead.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bde1Token}`, 'x-client-version': '1.2.0' },
      body: JSON.stringify({ status: 'registered' })
    });
    assert.equal(passReg.status, 200);
    assert.equal((await passReg.json()).data.status, 'registered');
  });

  it('ITEMS 4 & 5: My Leads endpoint returns callCount per lead and supports assignedAt filtering', async () => {
    try {
      const res = await fetch(`${baseURL}/api/leads/my-leads`, {
        headers: {
          Authorization: `Bearer ${bde1Token}`,
          'x-client-version': '1.2.0'
        }
      });

      if (res.status !== 200) {
        const errText = await res.text();
        console.error('FETCH ERROR:', res.status, errText);
        assert.fail(`GET /api/leads/my-leads returned status ${res.status}: ${errText}`);
      }

      const body = await res.json();
      console.log('GET MY LEADS SUCCESS BODY:', JSON.stringify(body));
      assert.equal(body.success, true);
      assert.ok(Array.isArray(body.data));
      assert.ok(body.data.length > 0, 'body.data array should not be empty');
      assert.equal(typeof body.data[0].callCount, 'number');
    } catch (err) {
      console.error('ITEMS 4 & 5 TEST ERROR:', err);
      throw err;
    }
  });

  it('REFERENCE FIELDS: Lead creation with referenceName and referenceNumber persists both fields', async () => {
    const res = await fetch(`${baseURL}/api/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
        'x-client-version': '1.2.0'
      },
      body: JSON.stringify({
        name: 'Referred Student',
        phone: '9776655443',
        country: 'India',
        referenceName: 'John Referee',
        referenceNumber: 'REF-998877'
      })
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.referenceName, 'John Referee');
    assert.equal(body.data.referenceNumber, 'REF-998877');
  });

  it('REFERENCE FIELDS: Lead creation without reference fields defaults referenceName and referenceNumber to null (optional)', async () => {
    const res = await fetch(`${baseURL}/api/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
        'x-client-version': '1.2.0'
      },
      body: JSON.stringify({
        name: 'Standard Student',
        phone: '9776655444',
        country: 'India'
      })
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.referenceName, null);
    assert.equal(body.data.referenceNumber, null);
  });

  it('MANUAL LEAD CREATION: Lead creation succeeds without country and defaults to India', async () => {
    const res = await fetch(`${baseURL}/api/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
        'x-client-version': '1.2.0'
      },
      body: JSON.stringify({
        name: 'No Country Student',
        phone: '9776655555'
      })
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.country, 'India');
  });

  it('EXPORT / BACKUP / RESTORE: Export report returns XLSX workbook buffer and backup returns JSON bundle', async () => {
    // 1. Export Report (.xlsx)
    const reportRes = await fetch(`${baseURL}/api/system/export/report?startDate=2026-01-01&endDate=2026-12-31`, {
      headers: { Authorization: `Bearer ${adminToken}`, 'x-client-version': '1.2.0' }
    });
    assert.equal(reportRes.status, 200);
    assert.match(reportRes.headers.get('content-type'), /spreadsheetml/);

    // 2. Export Backup (JSON)
    const backupRes = await fetch(`${baseURL}/api/system/export/backup`, {
      headers: { Authorization: `Bearer ${adminToken}`, 'x-client-version': '1.2.0' }
    });
    assert.equal(backupRes.status, 200);
    const backupBody = await backupRes.json();
    assert.equal(backupBody.success, true);
    assert.ok(backupBody.data.exportedAt);
    assert.ok(Array.isArray(backupBody.data.leads));
    assert.ok(Array.isArray(backupBody.data.callLogs));
    assert.ok(Array.isArray(backupBody.data.payments));
  });

  it('EXPORT / BACKUP / RESTORE: Restore without confirmFullReplace flag is rejected with 400 Bad Request', async () => {
    const backupRes = await fetch(`${baseURL}/api/system/export/backup`, {
      headers: { Authorization: `Bearer ${adminToken}`, 'x-client-version': '1.2.0' }
    });
    const backupData = (await backupRes.json()).data;

    const restoreRes = await fetch(`${baseURL}/api/system/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}`, 'x-client-version': '1.2.0' },
      body: JSON.stringify({ confirmFullReplace: false, backupData })
    });

    assert.equal(restoreRes.status, 400);
    const body = await restoreRes.json();
    assert.equal(body.success, false);
    assert.match(body.message, /confirmFullReplace: true is required/);
  });

  it('EXPORT / BACKUP / RESTORE: Full-replace restore replaces database content inside a transaction', async () => {
    const backupRes = await fetch(`${baseURL}/api/system/export/backup`, {
      headers: { Authorization: `Bearer ${adminToken}`, 'x-client-version': '1.2.0' }
    });
    const backupData = (await backupRes.json()).data;

    const restoreRes = await fetch(`${baseURL}/api/system/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}`, 'x-client-version': '1.2.0' },
      body: JSON.stringify({ confirmFullReplace: true, backupData })
    });

    assert.equal(restoreRes.status, 200);
    const body = await restoreRes.json();
    assert.equal(body.success, true);
  });

  it('EXPORT / BACKUP / RESTORE: Simulated failure mid-restore triggers transaction rollback and leaves original data intact', async () => {
    const preCount = await Lead.count();

    const backupRes = await fetch(`${baseURL}/api/system/export/backup`, {
      headers: { Authorization: `Bearer ${adminToken}`, 'x-client-version': '1.2.0' }
    });
    const backupData = (await backupRes.json()).data;

    const restoreRes = await fetch(`${baseURL}/api/system/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}`, 'x-client-version': '1.2.0' },
      body: JSON.stringify({ confirmFullReplace: true, backupData, simulateFailure: true })
    });

    assert.equal(restoreRes.status, 500);
    const body = await restoreRes.json();
    assert.equal(body.success, false);
    assert.match(body.message, /Restore failed and transaction rolled back/);

    const postCount = await Lead.count();
    assert.equal(postCount, preCount, 'Database lead count should remain unchanged after transaction rollback');
  });

  after(async () => {
    if (server) server.close();
    await Payment.destroy({ where: {} });
    await CallLog.destroy({ where: {} });
    await Lead.destroy({ where: {} });
    await User.destroy({ where: { email: { [sequelize.Sequelize.Op.like]: 'academy_%' } } });
  });
});
