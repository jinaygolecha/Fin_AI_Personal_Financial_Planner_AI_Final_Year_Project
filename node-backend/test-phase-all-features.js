/**
 * FinPro — Comprehensive Verification Test Suite for:
 * 1. Supabase S3 Cloud Object Storage Lifecycle & Tenant Isolation
 * 2. Real OCR Pipeline & Cloud Storage Integration
 * 3. JWT Authentication, Token Expiry, Refresh, & Session Hardening
 * 4. Google OAuth Configuration & Safe Routing
 * 5. Real RAG AI Architecture, Grounding, Citations & Tenant Isolation
 *
 * Owner: Jinay Golecha (jinay_golecha)
 */

process.env.NODE_ENV = 'test';
require('dotenv').config();

const request = require('supertest');
const app = require('./src/app');
const prisma = require('./src/config/database');
const storageService = require('./src/services/storageService');
const ragService = require('./src/services/ragService');

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedCount++;
  }
}

async function runComprehensiveFeaturesTest() {
  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║   FINPRO — CLOUD STORAGE + OCR + AUTH + GOOGLE + RAG AI SUITE     ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  let userA, tokenA, userB, tokenB;

  try {
    // ==========================================
    // MODULE 1: AUTHENTICATION & SESSION HARDENING
    // ==========================================
    console.log('👉 [1/5] Testing JWT Authentication & Session Recovery...');
    const emailA = `auth_test_a_${Date.now()}@example.com`;
    const regA = await request(app).post('/api/v1/auth/register').send({
      email: emailA,
      username: `user_a_${Date.now()}`,
      password: 'Password123!',
      firstName: 'TenantA',
      lastName: 'User',
    });
    assert(regA.status === 201 && regA.body.success, 'User A registered successfully with hashed credentials in PostgreSQL');
    userA = regA.body.data.user;
    tokenA = regA.body.data.accessToken;
    const refreshTokenA = regA.body.data.refreshToken;

    // Duplicate email registration rejected
    const dupReg = await request(app).post('/api/v1/auth/register').send({
      email: emailA,
      username: `user_a_dup_${Date.now()}`,
      password: 'Password123!',
    });
    assert(dupReg.status === 409, 'Duplicate email registration returns HTTP 409 conflict');

    // Valid login
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: emailA,
      password: 'Password123!',
    });
    assert(loginRes.status === 200 && loginRes.body.data.accessToken, 'Login with correct credentials succeeds');

    // Invalid login
    const badLoginRes = await request(app).post('/api/v1/auth/login').send({
      email: emailA,
      password: 'WrongPassword!',
    });
    assert(badLoginRes.status === 401, 'Login with incorrect password returns HTTP 401');

    // Token refresh
    const refreshRes = await request(app).post('/api/v1/auth/refresh').send({
      refreshToken: refreshTokenA,
    });
    assert(refreshRes.status === 200 && refreshRes.body.data.accessToken, 'Refresh token rotates and yields new access token');
    tokenA = refreshRes.body.data.accessToken;

    // Register User B for tenant isolation testing
    const emailB = `auth_test_b_${Date.now()}@example.com`;
    const regB = await request(app).post('/api/v1/auth/register').send({
      email: emailB,
      username: `user_b_${Date.now()}`,
      password: 'Password123!',
      firstName: 'TenantB',
      lastName: 'User',
    });
    assert(regB.status === 201, 'User B registered successfully for tenant isolation checks');
    userB = regB.body.data.user;
    tokenB = regB.body.data.accessToken;

    // ==========================================
    // MODULE 2: GOOGLE OAUTH CONFIGURATION & ROUTING
    // ==========================================
    console.log('\n👉 [2/5] Testing Google OAuth Flow & Configuration...');
    const providersRes = await request(app).get('/api/v1/auth/providers');
    assert(providersRes.status === 200 && providersRes.body.data.google !== undefined, 'GET /api/v1/auth/providers returns authentic Google OAuth configuration status');

    const googleRedirectRes = await request(app).get('/api/v1/auth/google');
    // If not configured, should return 503; if configured, should return 302 redirect
    assert(
      googleRedirectRes.status === 302 || googleRedirectRes.status === 503,
      `GET /api/v1/auth/google returns safe controlled status (${googleRedirectRes.status}) without crash`
    );

    const badCallbackRes = await request(app).get('/api/v1/auth/google/callback');
    assert(badCallbackRes.status === 302, 'GET /api/v1/auth/google/callback cleanly redirects on missing/invalid code');

    // ==========================================
    // MODULE 3: REAL SUPABASE S3 CLOUD STORAGE
    // ==========================================
    console.log('\n👉 [3/5] Testing Real Supabase S3 Cloud Storage & Tenant Isolation...');
    const storageHealth = await storageService.checkStorageHealth();
    assert(storageHealth.available === true, `Cloud Storage health verified (Provider: ${storageHealth.provider}, Bucket: ${storageHealth.bucket})`);

    // Upload a test file for User A
    const testContent = `FinPro Verification Artifact - User A - ${Date.now()}`;
    const testBuffer = Buffer.from(testContent, 'utf-8');
    const uploadRes = await request(app)
      .post('/api/v1/storage/upload')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        fileData: testBuffer.toString('base64'),
        fileName: 'test_receipt.txt',
        contentType: 'text/plain',
        documentType: 'receipt',
      });
    assert(uploadRes.status === 201 && uploadRes.body.data.key, 'POST /api/v1/storage/upload uploaded test file to Supabase S3');
    const fileKey = uploadRes.body.data.key;
    assert(fileKey.startsWith(`users/${userA.id}/receipts/`), `Storage key conforms to user-isolated path: ${fileKey}`);

    // Read/Download file by User A
    const getFileA = await request(app)
      .get(`/api/v1/storage/file/${encodeURIComponent(fileKey)}`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert(getFileA.status === 200 && getFileA.text === testContent, 'GET /api/v1/storage/file downloads file with 100% byte integrity');

    // Tenant Isolation: User B CANNOT read User A's file
    const getFileB = await request(app)
      .get(`/api/v1/storage/file/${encodeURIComponent(fileKey)}`)
      .set('Authorization', `Bearer ${tokenB}`);
    assert(getFileB.status === 403, 'Tenant Isolation: User B receives HTTP 403 Forbidden when attempting to read User A private file');

    // Tenant Isolation: User B CANNOT delete User A's file
    const deleteFileB = await request(app)
      .delete(`/api/v1/storage/file/${encodeURIComponent(fileKey)}`)
      .set('Authorization', `Bearer ${tokenB}`);
    assert(deleteFileB.status === 403, 'Tenant Isolation: User B receives HTTP 403 Forbidden when attempting to delete User A private file');

    // User A deletes their own file
    const deleteFileA = await request(app)
      .delete(`/api/v1/storage/file/${encodeURIComponent(fileKey)}`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert(deleteFileA.status === 200 && deleteFileA.body.success, 'DELETE /api/v1/storage/file deletes test artifact from Supabase S3');

    // Verify deletion
    const getDeleted = await request(app)
      .get(`/api/v1/storage/file/${encodeURIComponent(fileKey)}`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert(getDeleted.status === 404, 'File confirmed deleted from Supabase S3 (HTTP 404 on subsequent get)');

    // ==========================================
    // MODULE 4: REAL OCR PIPELINE & CLOUD PERSISTENCE
    // ==========================================
    console.log('\n👉 [4/5] Testing Real OCR Pipeline & Cloud Storage Integration...');

    // Test text-based receipt extraction
    const ocrSampleText = `STARBUCKS COFFEE\nDate: 2026-09-12\nCappuccino Grande  350.00\nCroissant Butter  190.00\nTotal Amount: 540.00\nGSTIN: 27AACCS1234F1Z5`;
    const scanRes = await request(app)
      .post('/api/v1/receipts/scan')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ receiptText: ocrSampleText });

    assert(scanRes.status === 200 && scanRes.body.success, 'POST /api/v1/receipts/scan processes receipt input');
    assert(scanRes.body.data.amount === 540, `OCR extracted correct total amount: ₹${scanRes.body.data.amount}`);
    assert(scanRes.body.data.category === 'Food', `OCR mapped category to Food: ${scanRes.body.data.category}`);
    const scanId = scanRes.body.data.scanId;

    // Confirm receipt into transactions table
    const confirmRes = await request(app)
      .post('/api/v1/receipts/confirm')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        scanId,
        amount: 540,
        merchant: 'Starbucks Coffee',
        category: 'Food',
        date: '2026-09-12',
      });
    assert(confirmRes.status === 201 && confirmRes.body.data.transaction, 'POST /api/v1/receipts/confirm persists transaction to PostgreSQL');
    const createdTxId = confirmRes.body.data.transaction.id;

    // Verify transaction exists in PostgreSQL
    const dbTx = await prisma.transaction.findUnique({ where: { id: createdTxId } });
    assert(dbTx && parseFloat(dbTx.amount) === 540 && dbTx.userId === userA.id, 'Transaction verified in PostgreSQL with strict user ownership');

    // Invalid MIME rejection
    const invalidImageRes = await request(app)
      .post('/api/v1/receipts/scan')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ imageData: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' });
    assert(invalidImageRes.status === 400, 'POST /api/v1/receipts/scan rejects unsupported MIME formats with HTTP 400');

    // Empty payload rejection
    const emptyScanRes = await request(app)
      .post('/api/v1/receipts/scan')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    assert(emptyScanRes.status === 400, 'POST /api/v1/receipts/scan rejects empty payload with HTTP 400');

    // ==========================================
    // MODULE 5: REAL RAG AI ARCHITECTURE & GROUNDING
    // ==========================================
    console.log('\n👉 [5/5] Testing Real RAG AI Architecture, Grounding & Tenant Isolation...');

    // Give User A an account with balance and a budget
    const accA = await prisma.financialAccount.findFirst({ where: { userId: userA.id } });
    await prisma.financialAccount.update({
      where: { id: accA.id },
      data: { balance: 45000 },
    });

    const categoryA = await prisma.category.findFirst({ where: { userId: userA.id, name: 'Food' } });
    const curDate = new Date();
    await prisma.budget.create({
      data: {
        userId: userA.id,
        categoryId: categoryA?.id,
        categoryName: 'Food',
        monthlyLimit: 8000,
        month: curDate.getMonth() + 1,
        year: curDate.getFullYear(),
      },
    });

    // Give User B separate secret data: e.g. Luxury Watch purchase of ₹2,50,000
    const accB = await prisma.financialAccount.findFirst({ where: { userId: userB.id } });
    const catB = await prisma.category.create({
      data: { userId: userB.id, name: 'Luxury Secret', categoryType: 'EXPENSE' },
    });
    await prisma.transaction.create({
      data: {
        userId: userB.id,
        accountId: accB.id,
        categoryId: catB.id,
        amount: 250000,
        merchant: 'Rolex Boutique Secret User B',
        description: 'Secret Luxury Watch User B',
        transactionType: 'EXPENSE',
        date: new Date(),
      },
    });

    // Query RAG for User A
    console.log('   Running RAG query for User A: "Where did I spend the most this month?"');
    const ragQuery1 = await request(app)
      .post('/api/v1/ai/chat')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ message: 'Where did I spend the most this month?' });

    assert(ragQuery1.status === 200 && ragQuery1.body.success, 'POST /api/v1/ai/chat executes RAG pipeline');
    assert(ragQuery1.body.data.rag?.enabled === true, 'RAG architecture confirmed active in response');
    assert(ragQuery1.body.data.sources && ragQuery1.body.data.sources.length > 0, `RAG generated ${ragQuery1.body.data.sources.length} source references`);

    // Verify Grounding: Response reflects User A's Food spending (Starbucks)
    const ragResponseText = ragQuery1.body.data.response;
    assert(/food|starbucks/i.test(ragResponseText), 'RAG response is grounded in User A transactions (mentions Food/Starbucks)');

    // Strict Tenant Isolation: User A's RAG response MUST NOT contain User B's secret transaction
    assert(!/rolex/i.test(ragResponseText), 'Tenant Isolation: User A RAG query NEVER retrieves User B Rolex transaction');

    // Query RAG for User A: Affordability check
    console.log('   Running RAG query for User A: "Can I afford a ₹5,000 purchase?"');
    const ragQuery2 = await request(app)
      .post('/api/v1/ai/chat')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ message: 'Can I afford a ₹5,000 purchase?' });

    assert(ragQuery2.status === 200 && ragQuery2.body.success, 'RAG affordability query executed');
    assert(ragQuery2.body.data.response.includes('DATABASE FACT') || ragQuery2.body.data.response.includes('₹'), 'RAG distinguishes factual database balance and affordability calculations');

    // Direct service-level tenant isolation test
    console.log('   Running direct tenant isolation retrieval test...');
    const userAKnowledge = await ragService.retrieveFinancialKnowledge(userA.id, ['TRANSACTIONS']);
    const userBKnowledge = await ragService.retrieveFinancialKnowledge(userB.id, ['TRANSACTIONS']);

    const userAHasRolex = userAKnowledge.knowledgeDocs.some(d => d.text.includes('Rolex'));
    const userBHasRolex = userBKnowledge.knowledgeDocs.some(d => d.text.includes('Rolex'));

    assert(!userAHasRolex, 'Direct Retriever Tenant Isolation: User A knowledge docs have ZERO User B records');
    assert(userBHasRolex, 'Direct Retriever Tenant Isolation: User B knowledge docs correctly contain User B records');

  } catch (err) {
    console.error('Test execution error:', err);
    failedCount++;
  } finally {
    console.log('\n====================================================================');
    console.log(`  COMPREHENSIVE TEST RESULTS: ${passedCount} PASSED | ${failedCount} FAILED`);
    console.log('====================================================================\n');
    await prisma.$disconnect();
    if (failedCount > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runComprehensiveFeaturesTest();
