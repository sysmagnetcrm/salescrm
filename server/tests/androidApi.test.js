import { describe, test, before, after } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import sequelize from '../config/database.js';
import { User, Lead, CallLog } from '../models/index.js';
import authRoutes from '../routes/authRoutes.js';
import leadRoutes from '../routes/leadRoutes.js';
import callRoutes from '../routes/callRoutes.js';
import { enforceClientVersion } from '../middleware/versionCheck.js';

const app = express();
app.use(express.json());
app.use(enforceClientVersion);
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/calls', callRoutes);

describe('Android Mobile API & Integration Test Suite', () => {
  let server, baseURL;
  let androidUser, androidToken;
  let mobileLead;

  before(async () => {
    await sequelize.sync();

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseURL = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });

    androidUser = await User.create({
      name: 'Android Mobile BDE',
      email: 'android.bde@test.com',
      password: 'Password123!',
      role: 'salesperson',
      phone: '9988776655',
      branch: 'kochi'
    });

    const loginRes = await fetch(`${baseURL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-version': '1.2.0'
      },
      body: JSON.stringify({ identifier: 'android.bde@test.com', password: 'Password123!' })
    });
    const loginJson = await loginRes.json();
    androidToken = loginJson.data.token;

    mobileLead = await Lead.create({
      name: 'Mobile App Lead',
      phone: '9888899999',
      country: 'India',
      assignedTo: androidUser.id,
      status: 'fresh'
    });
  });

  after(async () => {
    if (mobileLead) await Lead.destroy({ where: { id: mobileLead.id } });
    if (androidUser) await User.destroy({ where: { id: androidUser.id } });
    if (server) await new Promise((resolve) => server.close(resolve));
  });

  test('Obsolete mobile client version (0.9.0) is rejected with 426 Upgrade Required', async () => {
    const res = await fetch(`${baseURL}/api/leads/queue`, {
      headers: {
        'Authorization': `Bearer ${androidToken}`,
        'x-client-version': '0.9.0'
      }
    });
    assert.equal(res.status, 426);
  });

  test('Supported mobile client version (1.2.0) loads deterministic queue', async () => {
    const res = await fetch(`${baseURL}/api/leads/queue`, {
      headers: {
        'Authorization': `Bearer ${androidToken}`,
        'x-client-version': '1.2.0'
      }
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.length > 0);
  });

  test('Mobile client logs call lifecycle state machine transition cleanly', async () => {
    const res = await fetch(`${baseURL}/api/calls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${androidToken}`,
        'x-client-version': '1.2.0'
      },
      body: JSON.stringify({
        leadId: mobileLead.id,
        phoneNumber: mobileLead.phone,
        callStatus: 'initiated',
        callDirection: 'outbound'
      })
    });
    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.callerUserId, androidUser.id);
  });
});
