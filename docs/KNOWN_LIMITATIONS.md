# Jinay Finance AI — Known Limitations & External Service Notes
**Project:** Jinay Finance AI  
**Owner:** Jinay Golecha (`jinay_golecha`)

---

## 1. External API Quotas & Rate Limits

### 1.1 Alpha Vantage (Free Tier)
- **Rate Limit:** Standard free tier accounts are limited to **25 requests per day** and **5 requests per minute**.
- **Engine Mitigation:** The backend implements an intelligent in-memory TTL caching engine (`marketService.js`):
  - Live Quotes: Cached for 3 minutes.
  - Multi-Timeframe Charts: Cached for 15 minutes.
  - Company Overview & Fundamentals: Cached for 1 hour.
  - Commodities & Metals: Cached for 5 minutes.
- **Graceful Fallback:** If Alpha Vantage quota is reached, the service automatically falls back to Finnhub for stock quotes, and uses verified reference prices in INR with transparent source badges.

### 1.2 Google Gemini AI
- **Model Support:** Defaults to `gemini-2.5-flash` with automatic fallback cascade to `gemini-1.5-flash`, `gemini-1.5-pro`, and `gemini-pro`.
- **Offline / Unconfigured Mode:** If `GEMINI_API_KEY` is missing or quota is exhausted, the AI engine uses a built-in deterministic financial rule-based expert system that analyzes the user's actual database numbers (Net Worth, Emergency Fund, DTI ratio, 50/30/20 budget breakdown).

### 1.3 Google OAuth 2.0
- **Local Development:** When `GOOGLE_CLIENT_ID` is set to placeholder values, Google Sign-In displays a helpful configuration modal guiding the developer to set up Google Cloud credentials. Standard email/password authentication is fully active out-of-the-box.

---

## 2. Browser Environment Requirements

### 2.1 Voice Input (Web Speech API)
- **Supported Browsers:** Google Chrome, Microsoft Edge, Safari, Opera (browsers supporting `webkitSpeechRecognition` or `SpeechRecognition`).
- **Microphone Permissions:** Requires explicit microphone access permission from the browser. If denied, the UI displays a clean alert rather than failing silently.

### 2.2 OCR Receipt Scanning
- **Supported Formats:** Standard image files (`.png`, `.jpg`, `.jpeg`) and clear text photos.
- **Safety Gate:** Extracted amounts, dates, and merchants are presented in an editable confirmation modal prior to committing the transaction to PostgreSQL.
