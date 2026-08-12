from datetime import datetime
import pytz
import requests
from users.utils import format_inr

class MarketDataService:
    FALLBACK_QUOTES = {
        'RELIANCE': {'price': 2850.50, 'change': 35.20, 'change_pct': 1.25, 'name': 'Reliance Industries Ltd'},
        'TCS': {'price': 3950.00, 'change': -12.40, 'change_pct': -0.31, 'name': 'Tata Consultancy Services'},
        'INFY': {'price': 1620.75, 'change': 18.50, 'change_pct': 1.15, 'name': 'Infosys Limited'},
        'HDFCBANK': {'price': 1680.00, 'change': 5.60, 'change_pct': 0.33, 'name': 'HDFC Bank Ltd'},
        'ICICIBANK': {'price': 1120.30, 'change': 8.90, 'change_pct': 0.80, 'name': 'ICICI Bank Ltd'},
        'GOLD': {'price': 72500.00, 'change': 210.00, 'change_pct': 0.29, 'name': '24K Digital Gold (10g)'},
        'BTC': {'price': 5850000.00, 'change': 120000.00, 'change_pct': 2.09, 'name': 'Bitcoin'},
        'ETH': {'price': 295000.00, 'change': 4500.00, 'change_pct': 1.55, 'name': 'Ethereum'},
    }

    @staticmethod
    def get_quote(symbol):
        sym = symbol.upper().strip()
        tz = pytz.timezone('Asia/Kolkata')
        now_ist = datetime.now(tz)
        formatted_time = now_ist.strftime('%Y-%m-%d %I:%M:%S %p IST')
        
        # Check market open status (NSE open Mon-Fri 9:15 to 15:30 IST)
        weekday = now_ist.weekday()
        hour = now_ist.hour
        minute = now_ist.minute
        is_market_open = (weekday < 5) and ((hour > 9 or (hour == 9 and minute >= 15)) and (hour < 15 or (hour == 15 and minute <= 30)))
        status_label = "LIVE" if is_market_open else "MARKET CLOSED"

        # Try live Yahoo Finance API query for NSE ticker (e.g. RELIANCE.NS)
        try:
            ns_symbol = sym if ('.' in sym or sym in ['BTC', 'ETH']) else f"{sym}.NS"
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ns_symbol}?interval=1d"
            headers = {'User-Agent': 'Mozilla/5.0'}
            resp = requests.get(url, headers=headers, timeout=3)
            if resp.status_code == 200:
                result = resp.json().get('chart', {}).get('result')
                if result:
                    meta = result[0]['meta']
                    price = meta.get('regularMarketPrice')
                    prev_close = meta.get('previousClose') or price
                    change = price - prev_close
                    change_pct = (change / prev_close) * 100 if prev_close else 0.0
                    return {
                        "symbol": sym,
                        "name": meta.get('shortName', sym),
                        "price": float(price),
                        "formatted_price": format_inr(price),
                        "change": round(float(change), 2),
                        "change_pct": round(float(change_pct), 2),
                        "currency": "INR",
                        "market_status": status_label,
                        "timestamp": formatted_time,
                        "is_live": True
                    }
        except Exception:
            pass

        # Fallback to local cache/rates
        fallback = MarketDataService.FALLBACK_QUOTES.get(sym, {
            'price': 1000.00, 'change': 0.00, 'change_pct': 0.00, 'name': sym
        })

        return {
            "symbol": sym,
            "name": fallback['name'],
            "price": fallback['price'],
            "formatted_price": format_inr(fallback['price']),
            "change": fallback['change'],
            "change_pct": fallback['change_pct'],
            "currency": "INR",
            "market_status": status_label,
            "timestamp": formatted_time,
            "is_live": False
        }
