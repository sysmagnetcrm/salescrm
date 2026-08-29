import { describe, test, before, after } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import sequelize from '../config/database.js';
import { User, Lead, CallLog, Activity, CallTranscript, CallAIAnalysis } from '../models/index.js';
import authRoutes from '../routes/authRoutes.js';
import leadRoutes from '../routes/leadRoutes.js';
import callRoutes from '../routes/callRoutes.js';
import dispositionRoutes from '../routes/dispositionRoutes.js';
import { enforceClientVersion } from '../middleware/versionCheck.js';

const app = express();
app.use(express.json());
app.use(enforceClientVersion);
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/settings/dispositions', dispositionRoutes);

describe('BDE Workspace, Telephony & Call Intelligence Test Suite', () => {
  let server, baseURL;
  let adminToken, bdeToken1, bdeToken2, tlToken;
  let bdeUser1, bdeUser2, tlUser, adminUser;
  let lead1, lead2, callLog1;

  before(async () => {
    await sequelize.sync();

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseURL = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });

    // Create Admin User
    adminUser = await User.create({
      name: 'Admin Workspace User',
      email: 'admin.workspace@test.com',
      password: 'Password123!',
      role: 'admin',
      phone: '9900000000',
      branch: 'kochi'
    });

    const adminRes = await fetch(`${baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin.workspace@test.com', password: 'Password123!' })
    });
    const adminJson = await adminRes.json();
    adminToken = adminJson.data.token;

    // Create BDE 1 User
    bdeUser1 = await User.create({
      name: 'BDE User 1',
      email: 'bde1.workspace@test.com',
      password: 'Password123!',
      role: 'salesperson',
      phone: '9900001111',
      branch: 'kochi'
    });

    const bde1Res = await fetch(`${baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'bde1.workspace@test.com', password: 'Password123!' })
    });
    const bde1Json = await bde1Res.json();
    bdeToken1 = bde1Json.data.token;

    // Create BDE 2
    bdeUser2 = await User.create({
      name: 'BDE User 2',
      email: 'bde2.workspace@test.com',
      password: 'Password123!',
      role: 'salesperson',
      phone: '9900001122',
      branch: 'kochi'
    });

    const bde2Res = await fetch(`${baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'bde2.workspace@test.com', password: 'Password123!' })
    });
    const bde2Json = await bde2Res.json();
    bdeToken2 = bde2Json.data.token;

    // Create TL User
    tlUser = await User.create({
      name: 'TL Workspace User',
      email: 'tl.workspace@test.com',
      password: 'Password123!',
      role: 'admin',
      phone: '9900003344',
      branch: 'kochi'
    });

    const tlRes = await fetch(`${baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'tl.workspace@test.com', password: 'Password123!' })
    });
    const tlJson = await tlRes.json();
    tlToken = tlJson.data.token;

    // Create Test Leads for BDE 1
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    lead1 = await Lead.create({
      name: 'Overdue Lead A',
      phone: '9888800001',
      country: 'India',
      assignedTo: bdeUser1.id,
      status: 'follow-up',
      nextFollowUpAt: twoHoursAgo
    });

    lead2 = await Lead.create({
      name: 'Fresh Lead B',
      phone: '9888800002',
      country: 'India',
      assignedTo: bdeUser1.id,
      status: 'fresh'
    });
  });

  after(async () => {
    if (lead1) await Lead.destroy({ where: { id: lead1.id } });
    if (lead2) await Lead.destroy({ where: { id: lead2.id } });
    if (bdeUser1) await User.destroy({ where: { id: bdeUser1.id } });
    if (bdeUser2) await User.destroy({ where: { id: bdeUser2.id } });
    if (tlUser) await User.destroy({ where: { id: tlUser.id } });
    if (adminUser) await User.destroy({ where: { id: adminUser.id } });
    if (server) await new Promise((resolve) => server.close(resolve));
  });

  test('Deterministic Queue Engine prioritizes overdue missed follow-ups ahead of fresh leads', async () => {
    const res = await fetch(`${baseURL}/api/leads/queue`, {
      headers: { 'Authorization': `Bearer ${bdeToken1}` }
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.length >= 2);
    
    // First lead in queue should be overdue lead1
    assert.equal(json.data[0].id, lead1.id);
  });

  test('Save & Next updates lead status and allows advancing deterministically', async () => {
    const res = await fetch(`${baseURL}/api/leads/${lead1.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bdeToken1}`
      },
      body: JSON.stringify({
        status: 'follow-up',
        disposition: 'Call Back Requested',
        nextFollowUpAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        notes: 'Requested callback tomorrow morning.'
      })
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.disposition, 'Call Back Requested');
  });

  test('Call state machine accurately calculates connected talk duration vs lifecycle duration', async () => {
    const startTime = new Date(Date.now() - 60000); // 60s ago
    const connectTime = new Date(Date.now() - 40000); // 40s ago
    const endTime = new Date();

    const logRes = await fetch(`${baseURL}/api/calls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bdeToken1}`
      },
      body: JSON.stringify({
        leadId: lead2.id,
        callStatus: 'completed',
        phoneNumber: lead2.phone,
        startedAt: startTime,
        connectedAt: connectTime,
        endedAt: endTime,
        disposition: 'Interested'
      })
    });

    assert.equal(logRes.status, 201);
    const json = await logRes.json();
    callLog1 = json.data;

    // Talk time = ~40s, Lifecycle time = ~60s
    assert.ok(callLog1.durationSeconds >= 39 && callLog1.durationSeconds <= 42);
    assert.ok(callLog1.lifecycleDurationSeconds >= 59 && callLog1.lifecycleDurationSeconds <= 62);
  });

  test('TL calling on behalf of BDE preserves callerUserId = TL and leadOwnerId = BDE', async () => {
    const tlCallRes = await fetch(`${baseURL}/api/calls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tlToken}`
      },
      body: JSON.stringify({
        leadId: lead2.id,
        callStatus: 'completed',
        phoneNumber: lead2.phone,
        disposition: 'Follow-up Required'
      })
    });

    assert.equal(tlCallRes.status, 201);
    const json = await tlCallRes.json();
    assert.equal(json.data.callerUserId, tlUser.id);
    assert.equal(json.data.leadOwnerId, bdeUser1.id); // Lead owner remains BDE 1!
  });

  test('Protected recording audio endpoint enforces role authorization (403 IDOR Check)', async () => {
    // BDE 2 attempts to fetch BDE 1's call audio
    const idorRes = await fetch(`${baseURL}/api/calls/${callLog1.id}/audio`, {
      headers: { 'Authorization': `Bearer ${bdeToken2}` }
    });
    assert.equal(idorRes.status, 403);

    // BDE 1 (owner/caller) fetches own call audio
    const validRes = await fetch(`${baseURL}/api/calls/${callLog1.id}/audio`, {
      headers: { 'Authorization': `Bearer ${bdeToken1}` }
    });
    assert.equal(validRes.status, 200);
    const validJson = await validRes.json();
    assert.equal(validJson.data.isAuthorized, true);
  });

  test('Async AI Call Intelligence triggers with HTTP 202 Accepted without blocking API', async () => {
    const aiRes = await fetch(`${baseURL}/api/calls/${callLog1.id}/analyze`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${bdeToken1}` }
    });
    assert.equal(aiRes.status, 202);
    const json = await aiRes.json();
    assert.equal(json.success, true);
  });
});
