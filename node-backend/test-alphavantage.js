require('dotenv').config();
const axios = require('axios');

const AV_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const AV_BASE = 'https://www.alphavantage.co/query';

async function test() {
  console.log('AV Key:', AV_KEY);
  
  // Test 1: FX rate
  console.log('\n--- Test 1: USD/INR FX Rate ---');
  try {
    const r = await axios.get(AV_BASE, {
      params: { function: 'CURRENCY_EXCHANGE_RATE', from_currency: 'USD', to_currency: 'INR', apikey: AV_KEY },
      timeout: 10000,
    });
    console.log('Response:', JSON.stringify(r.data, null, 2).substring(0, 500));
  } catch (e) {
    console.error('Error:', e.message);
  }
  
  await new Promise(r => setTimeout(r, 1000));
  
  // Test 2: Stock quote
  console.log('\n--- Test 2: IBM Global Quote ---');
  try {
    const r = await axios.get(AV_BASE, {
      params: { function: 'GLOBAL_QUOTE', symbol: 'IBM', apikey: AV_KEY },
      timeout: 10000,
    });
    console.log('Response:', JSON.stringify(r.data, null, 2).substring(0, 400));
  } catch (e) {
    console.error('Error:', e.message);
  }
}

test().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
