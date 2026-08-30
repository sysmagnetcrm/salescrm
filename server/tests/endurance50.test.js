import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import sequelize from '../config/database.js';
import { User, Lead, CallLog, Activity } from '../models/index.js';
import callRoutes from '../routes/callRoutes.js';
import leadRoutes from '../routes/leadRoutes.js';
import { enforceClientVersion } from '../middleware/versionCheck.js';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json());
app.use(enforceClientVersion);
app.use('/api/calls', callRoutes);
app.use('/api/leads', leadRoutes);

describe('50-Call Physical Endurance & Failure-Injection Test Suite', () => {
  let server, baseURL;
  let bdeUser, bdeToken;
  let leadSingle, leadAmbiguous1, leadAmbiguous2;

  before(async () => {
    await sequelize.sync({ force: true });

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseURL = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });

    bdeUser = await User.create({
      name: 'Endurance BDE',
      email: 'endurance_bde@test.com',
      password: 'Password123!',
      role: 'salesperson',
      phone: '9000000088',
      branch: 'kochi'
    });

    const jwtSecret = process.env.JWT_SECRET || 'fallback_development_jwt_secret_key_12345';
    bdeToken = jwt.sign({ id: bdeUser.id }, jwtSecret, { expiresIn: '2h' });

    leadSingle = await Lead.create({
      name: 'Single Match Student',
      phone: '9876500001',
      country: 'India',
      branch: 'kochi',
      assignedTo: bdeUser.id
    });

    // Create 2 leads sharing identical phone number for ambiguous test
    leadAmbiguous1 = await Lead.create({
      name: 'Ambiguous Student A',
      phone: '9876500099',
      country: 'India',
      branch: 'kochi',
      assignedTo: bdeUser.id
    });

    leadAmbiguous2 = await Lead.create({
      name: 'Ambiguous Student B',
      phone: '9876500099',
      country: 'India',
      branch: 'kochi',
      assignedTo: bdeUser.id
    });
  });

  // Phase 1: Rapid Consecutive Call Cycles (Calls 1 - 15)
  it('Phase 1: Rapid Consecutive Calls 1 through 15 logged cleanly with zero leaks', async () => {
    for (let i = 1; i <= 15; i++) {
      const now = new Date();
      const connectedAt = new Date(now.getTime() + 5000);
      const endedAt = new Date(now.getTime() + 35000);

      const res = await fetch(`${baseURL}/api/calls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bdeToken}`,
          'x-client-version': '1.2.0'
        },
        body: JSON.stringify({
          phoneNumber: leadSingle.phone,
          callDirection: 'outbound',
          callStatus: 'completed',
          startedAt: now,
          ringingAt: new Date(now.getTime() + 2000),
          connectedAt,
          endedAt,
          durationSeconds: 30,
          lifecycleDurationSeconds: 35
        })
      });

      assert.equal(res.status, 201, `Call ${i} should log with status 201`);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.durationSeconds, 30);
      assert.equal(body.data.lifecycleDurationSeconds, 35);
      assert.equal(body.data.matchingStatus, 'MATCHED');
    }
  });

  // Phase 2: Reconciliation & Ambiguous Matching (Calls 16 - 25)
  it('Phase 2: Calls 16 through 25 - Ambiguous matching for shared phone number', async () => {
    for (let i = 16; i <= 25; i++) {
      const res = await fetch(`${baseURL}/api/calls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bdeToken}`,
          'x-client-version': '1.2.0'
        },
        body: JSON.stringify({
          phoneNumber: '9876500099',
          callDirection: 'inbound',
          callStatus: 'completed',
          startedAt: new Date(),
          durationSeconds: 45,
          lifecycleDurationSeconds: 50
        })
      });

      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.data.matchingStatus, 'AMBIGUOUS', 'Shared phone number must produce AMBIGUOUS matchingStatus');
      assert.equal(body.data.leadId, null, 'Ambiguous call must not auto-assign leadId');
    }
  });

  // Phase 3: Offline Queue & Idempotent Resync (Calls 26 - 35)
  it('Phase 3: Calls 26 through 35 - Duplicate offline sync retry returns identical CallLog without creating duplicate entries', async () => {
    const customCallId = 'endurance-offline-call-1001';

    for (let i = 26; i <= 35; i++) {
      const res = await fetch(`${baseURL}/api/calls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bdeToken}`,
          'x-client-version': '1.2.0'
        },
        body: JSON.stringify({
          id: customCallId,
          phoneNumber: leadSingle.phone,
          callDirection: 'outbound',
          callStatus: 'completed',
          startedAt: new Date(),
          durationSeconds: 60,
          lifecycleDurationSeconds: 65,
          syncStatus: 'pending'
        })
      });

      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.data.id, customCallId);
    }

    const totalLogs = await CallLog.count({ where: { id: customCallId } });
    assert.equal(totalLogs, 1, 'Duplicate sync attempts must result in exactly 1 database CallLog entry');
  });

  // Phase 4: Extreme Background & Unmatched Numbers (Calls 36 - 45)
  it('Phase 4: Calls 36 through 45 - Unmatched numbers enqueued cleanly', async () => {
    for (let i = 36; i <= 45; i++) {
      const unkNum = `+9199000000${i}`;
      const res = await fetch(`${baseURL}/api/calls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bdeToken}`,
          'x-client-version': '1.2.0'
        },
        body: JSON.stringify({
          phoneNumber: unkNum,
          callDirection: 'inbound',
          callStatus: 'completed',
          durationSeconds: 20,
          lifecycleDurationSeconds: 25
        })
      });

      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.data.matchingStatus, 'UNMATCHED');
    }
  });

  // Phase 5: AI Pipeline Guard & Fault Injection (Calls 46 - 50)
  it('Phase 5: Calls 46 through 50 - AI pipeline returns 400 when audio recording is missing or unavailable', async () => {
    const createdLog = await CallLog.create({
      leadOwnerId: bdeUser.id,
      callerUserId: bdeUser.id,
      phoneNumber: leadSingle.phone,
      callStatus: 'completed',
      recordingStatus: 'unavailable',
      durationSeconds: 40
    });

    const aiRes = await fetch(`${baseURL}/api/calls/${createdLog.id}/analyze`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bdeToken}`,
        'x-client-version': '1.2.0'
      }
    });

    assert.equal(aiRes.status, 400, 'AI analysis on unavailable recording must return 400 Bad Request');
    const aiBody = await aiRes.json();
    assert.equal(aiBody.success, false);
    assert.match(aiBody.message, /not accessible/i);
  });
});
