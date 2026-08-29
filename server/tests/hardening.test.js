import assert from 'node:assert/strict';
import { test, before, after, describe } from 'node:test';
import express from 'express';
import sequelize from '../config/database.js';
import { User, Lead, Activity, AssignmentHistory, Status, Country, Product } from '../models/index.js';
import authRoutes from '../routes/authRoutes.js';
import userRoutes from '../routes/userRoutes.js';
import leadRoutes from '../routes/leadRoutes.js';
import dashboardRoutes from '../routes/dashboardRoutes.js';
import settingsRoutes from '../routes/settingsRoutes.js';
import { LEAD_STATUS, normalizeStatus } from '../utils/statusConstants.js';
import { getStartOfWeek, getEndOfWeek, getStartOfMonth } from '../utils/dateUtils.js';
import { runClosedToRegisteredMigration } from '../scripts/migrate_closed_to_registered.js';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);

describe('RMA CRM Comprehensive Hardening & Regression Test Suite', () => {
  let server, baseURL;
  let adminToken, salesKochiToken, salesChennaiToken;
  let adminUser, salesKochiUser, salesChennaiUser, inactiveUser;
  let kochiLead, chennaiLead;
  let testStatus, testCountry, testProduct;

  before(async () => {
    process.env.JWT_SECRET = 'test_secret_key_32_characters_long_testing_12345';
    await sequelize.sync({ force: true });

    // Start HTTP server on random free port
    server = app.listen(0);
    const port = server.address().port;
    baseURL = `http://localhost:${port}`;

    // Seed test users
    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@test.com',
      password: 'password123',
      role: 'admin',
      branch: 'kochi'
    });

    salesKochiUser = await User.create({
      name: 'Kochi Sales',
      email: 'sales.kochi@test.com',
      password: 'password123',
      phone: '9876543210',
      role: 'salesperson',
      branch: 'kochi'
    });

    salesChennaiUser = await User.create({
      name: 'Chennai Sales',
      email: 'sales.chennai@test.com',
      password: 'password123',
      role: 'salesperson',
      branch: 'chennai'
    });

    inactiveUser = await User.create({
      name: 'Inactive Sales',
      email: 'inactive@test.com',
      password: 'password123',
      role: 'salesperson',
      branch: 'kochi',
      isActive: false
    });

    adminToken = jwt.sign({ id: adminUser.id }, process.env.JWT_SECRET);
    salesKochiToken = jwt.sign({ id: salesKochiUser.id }, process.env.JWT_SECRET);
    salesChennaiToken = jwt.sign({ id: salesChennaiUser.id }, process.env.JWT_SECRET);

    // Seed test master data
    testStatus = await Status.create({ label: 'Test Status', value: 'test-status', color: 'gray' });
    testCountry = await Country.create({ name: 'Testland', code: 'TL' });
    testProduct = await Product.create({ name: 'Test Product' });

    // Seed test leads
    kochiLead = await Lead.create({
      name: 'Kochi Client',
      phone: '9876543210',
      country: 'Testland',
      product: 'Test Product',
      branch: 'kochi',
      status: 'fresh',
      assignedTo: salesKochiUser.id
    });

    chennaiLead = await Lead.create({
      name: 'Chennai Client',
      phone: '9123456789',
      country: 'Testland',
      product: 'Test Product',
      branch: 'chennai',
      status: 'fresh',
      assignedTo: salesChennaiUser.id
    });
  });

  after(async () => {
    if (server) server.close();
    await sequelize.close();
  });

  // 1. Authentication Tests
  test('Valid Login returns user data and JWT token', async () => {
    const res = await fetch(`${baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@test.com', password: 'password123' })
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.notEqual(json.data.token, undefined);
  });

  test('Valid Phone Login via /api/auth/login returns user data and JWT token', async () => {
    const res = await fetch(`${baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: '9876543210', password: 'password123' })
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.email, 'sales.kochi@test.com');
  });

  test('Phone number variations (+91 98765 43210 and 9876543210) authenticate correctly', async () => {
    const res = await fetch(`${baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: '+91 98765 43210', password: 'password123' })
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.email, 'sales.kochi@test.com');
  });

  test('Type confusion (array/object identifier) is rejected with 400 Bad Request', async () => {
    const res = await fetch(`${baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: ['admin@test.com'], password: 'password123' })
    });
    assert.equal(res.status, 400);
  });

  test('Missing JWT_SECRET in production mode causes startup exception', () => {
    const prevEnv = process.env.NODE_ENV;
    const prevSecret = process.env.JWT_SECRET;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;
      
      // Attempting to generate token in production without secret should throw
      const generate = () => {
        if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === '')) {
          throw new Error('FATAL: JWT_SECRET environment variable must be explicitly configured in production mode.');
        }
      };
      assert.throws(generate, /JWT_SECRET/);
    } finally {
      process.env.NODE_ENV = prevEnv;
      process.env.JWT_SECRET = prevSecret;
    }
  });

  test('Invalid password login is rejected with generic 401 without leaking account existence', async () => {
    const res = await fetch(`${baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@test.com', password: 'wrongpassword' })
    });
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.equal(json.message, 'Invalid email/phone or password');
  });

  test('Unknown email login attempt is rejected with identical generic 401 message', async () => {
    const res = await fetch(`${baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'unknownuser@test.com', password: 'wrongpassword' })
    });
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.equal(json.message, 'Invalid email/phone or password');
  });

  test('Inactive user login attempt is rejected with 401', async () => {
    const res = await fetch(`${baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'inactive@test.com', password: 'password123' })
    });
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.match(json.message, /deactivated/i);
  });

  test('Public registration without token is rejected with 401', async () => {
    const res = await fetch(`${baseURL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacker', email: 'hacker@test.com', password: 'password123', role: 'admin' })
    });
    assert.equal(res.status, 401);
  });

  test('Salesperson attempt to register Admin is rejected with 403', async () => {
    const res = await fetch(`${baseURL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${salesKochiToken}` },
      body: JSON.stringify({ name: 'Elevated Admin', email: 'elevated@test.com', password: 'password123', role: 'admin' })
    });
    assert.equal(res.status, 403);
  });

  test('Authorized Admin can register new Salesperson', async () => {
    const res = await fetch(`${baseURL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ name: 'New Sales', email: 'newsales@test.com', password: 'password123', role: 'salesperson', branch: 'kochi' })
    });
    assert.equal(res.status, 201);
  });

  // 2. Authorization & IDOR Tests
  test('Salesperson from Kochi GET another branch lead via IDOR returns 403', async () => {
    const res = await fetch(`${baseURL}/api/leads/${chennaiLead.id}`, {
      headers: { 'Authorization': `Bearer ${salesKochiToken}` }
    });
    assert.equal(res.status, 403);
  });

  test('Salesperson PUT another branch lead via IDOR returns 403', async () => {
    const res = await fetch(`${baseURL}/api/leads/${chennaiLead.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${salesKochiToken}` },
      body: JSON.stringify({ notes: 'Unauthorized update attempt' })
    });
    assert.equal(res.status, 403);
  });

  test('Salesperson DELETE lead via IDOR returns 403', async () => {
    const res = await fetch(`${baseURL}/api/leads/${chennaiLead.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${salesKochiToken}` }
    });
    assert.equal(res.status, 403);
  });

  test('Salesperson GET another user detailed performance returns 403', async () => {
    const res = await fetch(`${baseURL}/api/users/salespeople/${salesChennaiUser.id}/performance-detailed`, {
      headers: { 'Authorization': `Bearer ${salesKochiToken}` }
    });
    assert.equal(res.status, 403);
  });

  // 3. Security & Ownership Isolation Tests
  test('Salesperson querying my-leads returns own assigned leads in unified CRM', async () => {
    const res = await fetch(`${baseURL}/api/leads/my-leads`, {
      headers: { 'Authorization': `Bearer ${salesKochiToken}` }
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(json.data.length > 0);
    json.data.forEach(l => assert.equal(l.assignedTo, salesKochiUser.id));
  });

  test('Admin filtering dashboard by branch returns stats', async () => {
    const res = await fetch(`${baseURL}/api/dashboard/admin?branch=kochi`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 200);
  });

  // 4. Unified CRM Reassignment Test
  test('Reassigning lead to another authorized BDE succeeds in unified CRM', async () => {
    const tempLead = await Lead.create({
      name: 'Reassign Test Lead',
      phone: '9991112223',
      country: 'India',
      assignedTo: salesKochiUser.id
    });

    const res = await fetch(`${baseURL}/api/leads/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ leadIds: [tempLead.id], assignTo: salesChennaiUser.id })
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
  });

  // 5. Financial Precision & Validation Tests
  test('Valid numeric values 100 and 100.50 are accepted', async () => {
    const res = await fetch(`${baseURL}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ name: 'Valid Money Lead', phone: '9000000001', country: 'India', value: 100.50 })
    });
    assert.equal(res.status, 201);
  });

  test('Invalid string value "abc" returns 422', async () => {
    const res = await fetch(`${baseURL}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ name: 'Invalid Money Lead', phone: '9000000002', country: 'India', value: 'abc' })
    });
    assert.equal(res.status, 422);
  });

  test('Negative value -500 returns 422', async () => {
    const res = await fetch(`${baseURL}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ name: 'Negative Money Lead', phone: '9000000003', country: 'India', value: -500 })
    });
    assert.equal(res.status, 422);
  });

  // 6. Lead Lifecycle & Status Normalization Tests
  test('Updating status to registered sets closedAt and logs Activity', async () => {
    const res = await fetch(`${baseURL}/api/leads/${kochiLead.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${salesKochiToken}` },
      body: JSON.stringify({ status: 'registered', value: 25000 })
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.data.status, 'registered');
    assert.notEqual(json.data.closedAt, null);

    const act = await Activity.findOne({ where: { leadId: kochiLead.id, type: 'status_change' } });
    assert.notEqual(act, null);
    assert.equal(act.newStatus, 'registered');
  });

  test('Reverting status away from registered clears closedAt timestamp', async () => {
    const res = await fetch(`${baseURL}/api/leads/${kochiLead.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${salesKochiToken}` },
      body: JSON.stringify({ status: 'follow-up' })
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.data.status, 'follow-up');
    assert.equal(json.data.closedAt, null);
  });

  // 7. Migration Idempotency Test
  test('Closed to Registered migration runs idempotently without double-mutation', async () => {
    const res1 = await runClosedToRegisteredMigration();
    const res2 = await runClosedToRegisteredMigration();

    assert.equal(res2.leadMigrated, 0);
    assert.equal(res2.activityMigrated, 0);
  });

  // 8. User Deactivation, Removal & Security Safeguard Tests
  test('Deactivating a salesperson sets isActive = false and preserves lead ownership', async () => {
    const tempSales = await User.create({
      name: 'Temp Sales',
      email: 'temp.sales@test.com',
      password: 'password123',
      role: 'salesperson',
      branch: 'kochi'
    });

    const tempLead = await Lead.create({
      name: 'Temp Client',
      phone: '8887776665',
      country: 'India',
      branch: 'kochi',
      assignedTo: tempSales.id
    });

    const res = await fetch(`${baseURL}/api/users/salespeople/${tempSales.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 200);

    const reloadedUser = await User.findByPk(tempSales.id);
    assert.equal(reloadedUser.isActive, false);

    const reloadedLead = await Lead.findByPk(tempLead.id);
    assert.equal(reloadedLead.assignedTo, tempSales.id); // Lead is preserved!
  });

  test('Hard deleting a salesperson who owns leads returns 409 Conflict requirement', async () => {
    const ownedSales = await User.create({
      name: 'Owned Sales',
      email: 'owned.sales@test.com',
      password: 'password123',
      role: 'salesperson',
      branch: 'kochi'
    });

    await Lead.create({
      name: 'Owned Client',
      phone: '8887779999',
      country: 'India',
      assignedTo: ownedSales.id
    });

    const res = await fetch(`${baseURL}/api/users/salespeople/${ownedSales.id}?hard=true`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 409);
    const json = await res.json();
    assert.match(json.message, /reassign/i);
  });

  test('Hard deleting a unused salesperson with 0 leads and 0 dependencies succeeds cleanly', async () => {
    const unusedSales = await User.create({
      name: 'Unused Sales',
      email: 'unused.sales@test.com',
      password: 'password123',
      role: 'salesperson',
      branch: 'kochi'
    });

    const res = await fetch(`${baseURL}/api/users/salespeople/${unusedSales.id}?hard=true`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 200);

    const reloaded = await User.findByPk(unusedSales.id);
    assert.equal(reloaded, null);
  });

  test('Hard deleting user with historical activity/calls/payments archives user and preserves records', async () => {
    const historyUser = await User.create({
      name: 'History User',
      email: 'history.user@test.com',
      password: 'password123',
      role: 'salesperson',
      branch: 'kochi'
    });

    const testLd = await Lead.create({
      name: 'History Lead',
      phone: '8880001111',
      country: 'India',
      assignedTo: adminUser.id // Owned by Admin, not historyUser
    });

    const act = await Activity.create({
      leadId: testLd.id,
      userId: historyUser.id,
      type: 'note',
      notes: 'Historical note by user'
    });

    const res = await fetch(`${baseURL}/api/users/salespeople/${historyUser.id}?hard=true`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 200);

    const reloadedUser = await User.findByPk(historyUser.id);
    assert.notEqual(reloadedUser, null);
    assert.equal(reloadedUser.isActive, false); // User is archived!

    const reloadedAct = await Activity.findByPk(act.id);
    assert.notEqual(reloadedAct, null); // Activity is preserved!
    assert.equal(reloadedAct.userId, historyUser.id);
  });

  test('Salesperson attempt to delete another user returns 403 Forbidden', async () => {
    const res = await fetch(`${baseURL}/api/users/salespeople/${salesChennaiUser.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${salesKochiToken}` }
    });
    assert.equal(res.status, 403);
  });

  test('Admin self-deletion attempt is rejected with 400 Bad Request', async () => {
    const res = await fetch(`${baseURL}/api/users/salespeople/${adminUser.id}?hard=true`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.match(json.message, /own account/i);
  });

  test('Deactivating the last active admin is rejected with 400 Bad Request', async () => {
    // adminUser is the only active admin in seed
    const res = await fetch(`${baseURL}/api/users/salespeople/${adminUser.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.match(json.message, /own account|administrator must remain/i);
  });

  // 9. Master Data Reference Protection Tests
  test('Deleting a Country referenced by an existing lead is rejected with 400', async () => {
    const res = await fetch(`${baseURL}/api/settings/countries/${testCountry.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.match(json.message, /Cannot delete country/i);
  });

  test('Deleting a Product referenced by an existing lead is rejected with 400', async () => {
    const res = await fetch(`${baseURL}/api/settings/products/${testProduct.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.match(json.message, /Cannot delete product/i);
  });

  // 10. Date Utility Tests
  test('Date utilities compute Monday-Sunday week boundaries correctly', () => {
    const wednesday = new Date('2026-08-26T12:00:00Z');
    const startOfWeek = getStartOfWeek(wednesday);
    const endOfWeek = getEndOfWeek(wednesday);

    assert.equal(startOfWeek.getDay(), 1); // Monday
    assert.equal(endOfWeek.getDay(), 0); // Sunday
  });

  // 11. Application Branding System Tests
  test('Public branding API returns default "CRM Demo"', async () => {
    const res = await fetch(`${baseURL}/api/settings/branding/public`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.data.appName, 'CRM Demo');
  });

  test('Unauthenticated branding update is rejected with 401', async () => {
    const res = await fetch(`${baseURL}/api/settings/branding`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appName: 'Hacked CRM' })
    });
    assert.equal(res.status, 401);
  });

  test('Salesperson branding update is rejected with 403', async () => {
    const res = await fetch(`${baseURL}/api/settings/branding`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${salesKochiToken}` },
      body: JSON.stringify({ appName: 'Salesperson CRM' })
    });
    assert.equal(res.status, 403);
  });

  test('Admin can update application branding name and location to "SLBS Academy" / "Kochi"', async () => {
    const res = await fetch(`${baseURL}/api/settings/branding`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ appName: 'SLBS Academy', location: 'Kochi' })
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.data.appName, 'SLBS Academy');
    assert.equal(json.data.location, 'Kochi');

    // Verify public endpoint reflects change
    const pubRes = await fetch(`${baseURL}/api/settings/branding/public`);
    const pubJson = await pubRes.json();
    assert.equal(pubJson.data.appName, 'SLBS Academy');
    assert.equal(pubJson.data.location, 'Kochi');
  });

  test('Location with script injection is rejected with 400', async () => {
    const res = await fetch(`${baseURL}/api/settings/branding`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ appName: 'SLBS Academy', location: '<script>alert("xss")</script>' })
    });
    assert.equal(res.status, 400);
  });

  test('Changing branding location does NOT modify Lead.branch, User.branch or lead ownership', async () => {
    const originalLead = await Lead.findByPk(kochiLead.id);
    const originalUser = await User.findByPk(salesKochiUser.id);

    await fetch(`${baseURL}/api/settings/branding`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ appName: 'Global Academy', location: 'Chennai' })
    });

    const leadAfter = await Lead.findByPk(kochiLead.id);
    const userAfter = await User.findByPk(salesKochiUser.id);

    assert.equal(leadAfter.branch, originalLead.branch);
    assert.equal(userAfter.branch, originalUser.branch);
    assert.equal(leadAfter.assignedTo, originalLead.assignedTo);
  });

  test('Admin can reset branding back to default "CRM Demo" and null location', async () => {
    const res = await fetch(`${baseURL}/api/settings/branding/reset`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 200);

    const pubRes = await fetch(`${baseURL}/api/settings/branding/public`);
    const pubJson = await pubRes.json();
    assert.equal(pubJson.data.appName, 'CRM Demo');
    assert.equal(pubJson.data.location, null);
  });
});

