import assert from 'node:assert/strict';
import { test, before, after, describe } from 'node:test';
import express from 'express';
import sequelize from '../config/database.js';
import { User, Lead, CallLog, CallAIAnalysis, CallTranscript } from '../models/index.js';
import authRoutes from '../routes/authRoutes.js';
import leadRoutes from '../routes/leadRoutes.js';
import callRoutes from '../routes/callRoutes.js';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/calls', callRoutes);

describe('Pipeline Failure Handling & Resiliency Test Suite', () => {
  let server, baseURL;
  let token, expiredToken;
  let user1, user2, lead1;

  before(async () => {
    process.env.JWT_SECRET = 'error_pipeline_test_secret_32_chars';
    await sequelize.sync({ force: true });

    server = app.listen(0);
    const port = server.address().port;
    baseURL = `http://localhost:${port}`;

    user1 = await User.create({
      name: 'Salesperson One',
      email: 'sp1@test.com',
      password: 'password123',
      role: 'salesperson',
      branch: 'kochi'
    });

    user2 = await User.create({
      name: 'Salesperson Two',
      email: 'sp2@test.com',
      password: 'password123',
      role: 'salesperson',
      branch: 'kochi'
    });

    token = jwt.sign({ id: user1.id, role: user1.role, branch: user1.branch }, process.env.JWT_SECRET, { expiresIn: '1h' });
    expiredToken = jwt.sign({ id: user1.id, role: user1.role, branch: user1.branch }, process.env.JWT_SECRET, { expiresIn: '-1s' });

    lead1 = await Lead.create({
      name: 'Lead One',
      phone: '9876543210',
      country: 'India',
      assignedTo: user1.id,
      branch: 'kochi'
    });
  });

  after(async () => {
    if (server) server.close();
  });

  test('1. Auth Token Expiry (401 Mid-Session): API rejects expired token cleanly with HTTP 401', async () => {
    const res = await fetch(`${baseURL}/api/calls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${expiredToken}`
      },
      body: JSON.stringify({
        phoneNumber: '9876543210',
        callDirection: 'outbound'
      })
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /Not authorized/i);
  });

  test('2. Unmatched CallLog Handling: Log call with unknown phone number creates UNMATCHED call record', async () => {
    const res = await fetch(`${baseURL}/api/calls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        phoneNumber: '9990001112',
        callDirection: 'outbound',
        callStatus: 'completed'
      })
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.matchingStatus, 'UNMATCHED');
    assert.equal(body.data.leadId, null);
  });

  test('3. Duplicate Lead Assignment Conflict (409): Returns DUPLICATE_ACTIVE_ASSIGNMENT with owner details', async () => {
    const res = await fetch(`${baseURL}/api/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'Duplicate Lead Candidate',
        phone: '9876543210',
        assignedTo: user2.id
      })
    });

    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.code, 'DUPLICATE_ACTIVE_ASSIGNMENT');
    assert.ok(body.assignedTo);
    assert.equal(body.assignedTo.id, user1.id);
    assert.equal(body.assignedTo.name, user1.name);
  });

  test('4. AI Pipeline Failure Handling: Missing audio recording rejects AI trigger gracefully', async () => {
    const callLog = await CallLog.create({
      leadId: lead1.id,
      leadOwnerId: user1.id,
      callerUserId: user1.id,
      callStatus: 'completed',
      recordingStatus: 'unavailable'
    });

    const res = await fetch(`${baseURL}/api/calls/${callLog.id}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /AI Analysis Unavailable/i);
  });
});
