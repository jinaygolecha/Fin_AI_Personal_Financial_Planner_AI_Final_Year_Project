import random
from datetime import datetime

class AIFinancialAdvisor:
    @staticmethod
    def get_financial_health_score(user_id):
        """
        Simulates a financial health score (0-100) based on debt-to-income,
        savings rate, and emergency fund status.
        """
        # In a real implementation, this would query the user's FinancialData,
        # Transactions, and Loans, and run a scoring algorithm.
        return random.randint(60, 95)
        
    @staticmethod
    def get_cash_flow_prediction(user_id, months=3):
        """
        Simulates future cash flow predictions using historical data.
        """
        return {
            "predicted_income_next_month": 55000.00,
            "predicted_expense_next_month": 40000.00,
            "confidence_score": 0.85
        }

    @staticmethod
    def get_investment_recommendation(user_id, risk_profile='Medium'):
        """
        Provides contextual portfolio recommendations.
        """
        if risk_profile == 'Low':
            return "Consider adding more Bonds or Fixed Deposits to stabilize your portfolio."
        elif risk_profile == 'High':
            return "You have room to allocate 10-15% more towards high-growth equities or Crypto."
        else:
            return "Your current 60/40 Equity-to-Debt ratio is well balanced."

class FraudDetector:
    @staticmethod
    def evaluate_transaction(amount, category, user_id):
        """
        Simulates a fraud/anomaly detection heuristic.
        """
        if float(amount) > 50000 and category == 'Unknown':
            return True, 0.95
        return False, 0.10
