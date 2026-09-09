const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const SCREENSHOT_DIR = path.resolve(__dirname, '../../docs/screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function getWsDebuggerUrl() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const tabs = JSON.parse(data);
        const pageTab = tabs.find(t => t.type === 'page' && t.url.includes('5000')) || tabs.find(t => t.type === 'page');
        if (pageTab) resolve(pageTab.webSocketDebuggerUrl);
        else reject(new Error('No open page tab found in Chrome.'));
      });
    }).on('error', reject);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log('🚀 Initiating FinPro Real Browser Screenshot Pipeline...');

  // 1. Get auth token
  const loginRes = await axios.post('http://127.0.0.1:5000/api/v1/auth/login', {
    email: 'demo@example.com',
    password: 'DemoPassword123!'
  });
  const { accessToken, refreshToken, user } = loginRes.data.data;
  console.log(`🔑 Authenticated as demo user: ${user.email}`);

  // 2. Connect to Chrome CDP
  const wsUrl = await getWsDebuggerUrl();
  console.log(`🌐 Connected to Chrome CDP: ${wsUrl}`);
  const ws = new WebSocket(wsUrl);

  let msgId = 1;
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = msgId++;
    const handler = (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.id === id) {
          ws.off('message', handler);
          if (msg.error) reject(new Error(JSON.stringify(msg.error)));
          else resolve(msg.result);
        }
      } catch (err) {
        reject(err);
      }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });

  await new Promise(res => ws.on('open', res));

  // Set desktop viewport (1440x900)
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  const injectAuth = async () => {
    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('jf_access_token', ${JSON.stringify(accessToken)});
        localStorage.setItem('jf_refresh_token', ${JSON.stringify(refreshToken)});
        localStorage.setItem('jf_user', ${JSON.stringify(JSON.stringify(user))});
      `
    });
  };

  const clearAuth = async () => {
    await send('Runtime.evaluate', {
      expression: `localStorage.clear();`
    });
  };

  const scenarios = [
    {
      name: '01-login.png',
      url: 'http://127.0.0.1:5000/login.html',
      auth: false,
      wait: 1000,
      action: async () => {}
    },
    {
      name: '02-signup.png',
      url: 'http://127.0.0.1:5000/signup.html',
      auth: false,
      wait: 1000,
      action: async () => {}
    },
    {
      name: '03-landing.png',
      url: 'http://127.0.0.1:5000/index.html',
      auth: false,
      wait: 1200,
      action: async () => {}
    },
    {
      name: '04-onboarding.png',
      url: 'http://127.0.0.1:5000/onboarding.html',
      auth: true,
      wait: 1200,
      action: async () => {}
    },
    {
      name: '05-dashboard.png',
      url: 'http://127.0.0.1:5000/dashboard.html',
      auth: true,
      wait: 2000,
      action: async () => {}
    },
    {
      name: '06-accounts.png',
      url: 'http://127.0.0.1:5000/dashboard.html',
      auth: true,
      wait: 1500,
      action: async () => {
        await send('Runtime.evaluate', { expression: 'window.scrollTo({ top: 380, behavior: "instant" })' });
        await sleep(500);
      }
    },
    {
      name: '07-budgets.png',
      url: 'http://127.0.0.1:5000/budget.html',
      auth: true,
      wait: 1800,
      action: async () => {}
    },
    {
      name: '08-goals.png',
      url: 'http://127.0.0.1:5000/goals.html',
      auth: true,
      wait: 1800,
      action: async () => {}
    },
    {
      name: '09-investments.png',
      url: 'http://127.0.0.1:5000/investments.html',
      auth: true,
      wait: 2000,
      action: async () => {}
    },
    {
      name: '10-market-data.png',
      url: 'http://127.0.0.1:5000/market.html',
      auth: true,
      wait: 2500,
      action: async () => {}
    },
    {
      name: '11-gold-silver.png',
      url: 'http://127.0.0.1:5000/market.html',
      auth: true,
      wait: 1500,
      action: async () => {
        await send('Runtime.evaluate', { expression: 'window.scrollTo({ top: 320, behavior: "instant" })' });
        await sleep(500);
      }
    },
    {
      name: '12-technical-charts.png',
      url: 'http://127.0.0.1:5000/market.html',
      auth: true,
      wait: 1500,
      action: async () => {
        await send('Runtime.evaluate', { expression: 'window.scrollTo({ top: 700, behavior: "instant" })' });
        await sleep(600);
      }
    },
    {
      name: '13-loans.png',
      url: 'http://127.0.0.1:5000/loans.html',
      auth: true,
      wait: 1800,
      action: async () => {}
    },
    {
      name: '14-prepayment-simulator.png',
      url: 'http://127.0.0.1:5000/loans.html',
      auth: true,
      wait: 1500,
      action: async () => {
        await send('Runtime.evaluate', {
          expression: `
            const m = document.getElementById('calcModal');
            if (m) m.classList.add('show');
            const p = document.getElementById('calcPrincipal');
            const r = document.getElementById('calcRate');
            const t = document.getElementById('calcTenure');
            if (p) p.value = 2500000;
            if (r) r.value = 8.75;
            if (t) t.value = 240;
            if (window.calcEMI) window.calcEMI();
          `
        });
        await sleep(600);
      }
    },
    {
      name: '15-insurance.png',
      url: 'http://127.0.0.1:5000/insurance.html',
      auth: true,
      wait: 1800,
      action: async () => {}
    },
    {
      name: '16-subscriptions.png',
      url: 'http://127.0.0.1:5000/insurance.html',
      auth: true,
      wait: 1500,
      action: async () => {
        await send('Runtime.evaluate', { expression: 'window.scrollTo({ top: 400, behavior: "instant" })' });
        await sleep(500);
      }
    },
    {
      name: '17-financial-health.png',
      url: 'http://127.0.0.1:5000/dashboard.html',
      auth: true,
      wait: 1800,
      action: async () => {
        await send('Runtime.evaluate', { expression: 'window.scrollTo({ top: 120, behavior: "instant" })' });
        await sleep(500);
      }
    },
    {
      name: '18-ai-advisor.png',
      url: 'http://127.0.0.1:5000/ai-advisor.html',
      auth: true,
      wait: 2000,
      action: async () => {}
    },
    {
      name: '19-what-if-simulator.png',
      url: 'http://127.0.0.1:5000/ai-advisor.html',
      auth: true,
      wait: 1500,
      action: async () => {
        await send('Runtime.evaluate', {
          expression: `
            const btn = document.getElementById('openSimulatorBtn');
            if (btn) btn.click();
            if (window.setSimPreset) window.setSimPreset(10, 0, 0, 0, 0, 'Salary +10%');
          `
        });
        await sleep(600);
      }
    },
    {
      name: '20-cash-flow.png',
      url: 'http://127.0.0.1:5000/dashboard.html',
      auth: true,
      wait: 1800,
      action: async () => {
        await send('Runtime.evaluate', { expression: 'window.scrollTo({ top: 600, behavior: "instant" })' });
        await sleep(600);
      }
    },
    {
      name: '21-ocr-receipt.png',
      url: 'http://127.0.0.1:5000/ai-advisor.html',
      auth: true,
      wait: 1500,
      action: async () => {
        await send('Runtime.evaluate', {
          expression: `
            const btn = document.getElementById('openOcrBtn');
            if (btn) btn.click();
            const inp = document.getElementById('receiptInput');
            if (inp) inp.value = 'STARBUCKS COFFEE INDIRANAGAR\\nDate: 2026-09-08\\nItem: Caramel Frappuccino\\nTotal: Rs 475.00';
          `
        });
        await sleep(600);
      }
    },
    {
      name: '22-voice-assistant.png',
      url: 'http://127.0.0.1:5000/ai-advisor.html',
      auth: true,
      wait: 1500,
      action: async () => {
        await send('Runtime.evaluate', {
          expression: `
            const vBtn = document.getElementById('voiceAssistantBtn');
            if (vBtn) vBtn.classList.add('recording');
          `
        });
        await sleep(500);
      }
    },
    {
      name: '23-financial-news.png',
      url: 'http://127.0.0.1:5000/market.html',
      auth: true,
      wait: 2000,
      action: async () => {
        await send('Runtime.evaluate', { expression: 'window.scrollTo({ top: 1100, behavior: "instant" })' });
        await sleep(600);
      }
    },
    {
      name: '24-tasks-reminders.png',
      url: 'http://127.0.0.1:5000/calendar.html',
      auth: true,
      wait: 1800,
      action: async () => {}
    },
    {
      name: '25-reports.png',
      url: 'http://127.0.0.1:5000/analytics.html',
      auth: true,
      wait: 2000,
      action: async () => {}
    },
    {
      name: '26-csv-import-export.png',
      url: 'http://127.0.0.1:5000/ai-advisor.html',
      auth: true,
      wait: 1500,
      action: async () => {
        await send('Runtime.evaluate', {
          expression: `
            const btn = document.getElementById('openImportBtn');
            if (btn) btn.click();
          `
        });
        await sleep(600);
      }
    },
    {
      name: '27-training-studio.png',
      url: 'http://127.0.0.1:5000/training.html',
      auth: true,
      wait: 2000,
      action: async () => {}
    },
    {
      name: '28-risk-radar.png',
      url: 'http://127.0.0.1:5000/ai-advisor.html',
      auth: true,
      wait: 1500,
      action: async () => {
        await send('Runtime.evaluate', {
          expression: `
            const btn = document.getElementById('openRiskRadarBtn');
            if (btn) btn.click();
          `
        });
        await sleep(600);
      }
    },
    {
      name: '29-transactions-ledger.png',
      url: 'http://127.0.0.1:5000/transactions.html',
      auth: true,
      wait: 1800,
      action: async () => {}
    },
    {
      name: '30-ml-prediction-engine.png',
      url: 'http://127.0.0.1:5000/training.html',
      auth: true,
      wait: 1500,
      action: async () => {
        await send('Runtime.evaluate', {
          expression: `
            if (window.switchTab) window.switchTab('predictTab');
          `
        });
        await sleep(600);
      }
    }
  ];

  console.log(`📸 Capturing ${scenarios.length} high-resolution real browser screenshots...`);

  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i];
    const prefix = `[${String(i + 1).padStart(2, '0')}/${scenarios.length}]`;

    // 1. Navigate to URL
    await send('Page.navigate', { url: s.url });
    await sleep(s.wait);

    // 2. Set/Clear Auth & Reload if needed
    if (s.auth) {
      await injectAuth();
    } else {
      await clearAuth();
    }

    // Give page time to load and render ECharts / DOM
    await sleep(s.wait);

    // 3. Execute scenario action
    await s.action();
    await sleep(400);

    // 4. Capture screenshot
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(screenshot.data, 'base64');
    const outPath = path.join(SCREENSHOT_DIR, s.name);
    fs.writeFileSync(outPath, buffer);

    const sizeKb = Math.round(buffer.length / 1024);
    console.log(`  ✅ ${prefix} Saved ${s.name} (${sizeKb} KB)`);
  }

  // Restore login on dashboard
  await send('Page.navigate', { url: 'http://127.0.0.1:5000/dashboard.html' });
  await injectAuth();
  await sleep(1000);

  ws.close();
  console.log('\n🎉 Successfully captured all 30 real FinPro screenshots into docs/screenshots/ !');
}

run().catch(err => {
  console.error('❌ Error capturing screenshots:', err);
  process.exit(1);
});
