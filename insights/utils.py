import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from django.db.models import Sum
from sklearn.linear_model import LinearRegression

from transactions.models import Transaction, Budget
from insights.models import SavingsGoal

def get_spending_insights(user):
    """Generates spending insights per category."""
    transactions = Transaction.objects.filter(user=user).select_related('category').values("category__name", "amount", "date")
    
    if not transactions:
        return []

    df = pd.DataFrame(transactions)
    df["date"] = pd.to_datetime(df["date"])
    df["category"] = df["category__name"].fillna("General")
    
    insights = df.groupby("category").agg(
        total_spent=pd.NamedAgg(column="amount", aggfunc="sum"),
        avg_spent=pd.NamedAgg(column="amount", aggfunc="mean")
    ).reset_index()

    return insights.to_dict("records")

def predict_future_spending(user, category):
    """Predicts future spending based on past transactions using Linear Regression."""
    transactions = Transaction.objects.filter(user=user, category__name=category).values("amount", "date")

    if len(transactions) < 2:
        return "Insufficient data for forecasting"

    df = pd.DataFrame(transactions)
    df["date"] = pd.to_datetime(df["date"])
    df["days"] = (df["date"] - df["date"].min()).dt.days
    
    X = df[["days"]].values
    y = df["amount"].astype(float).values

    model = LinearRegression()
    model.fit(X, y)

    future_date = (datetime.today() - df["date"].min()).days + 30
    future_spending = model.predict(np.array([[future_date]]))[0]

    return round(float(future_spending), 2)

def suggest_savings(user):
    """Suggests cost-cutting tips based on spending behavior."""
    insights = get_spending_insights(user)

    suggestions = []
    for item in insights:
        if float(item["total_spent"]) > 1000:
            suggestions.append(f"Reduce spending in {item['category']} (currently ₹{float(item['total_spent']):.2f}) to save more.")

    if not suggestions:
        suggestions.append("Great job! Your spending is well balanced across categories.")

    return suggestions

def track_savings_progress(user):
    """Automatically updates the saved amount in savings goals based on transactions."""
    goals = SavingsGoal.objects.filter(user=user, status="In Progress")

    for goal in goals:
        savings = Transaction.objects.filter(
            user=user,
            category_type="income",
            date__lte=goal.deadline
        ).aggregate(total_savings=Sum("amount"))["total_savings"] or 0.0
        
        goal.saved_amount = float(savings)
        goal.update_progress()
        goal.save()
    
    return goals
