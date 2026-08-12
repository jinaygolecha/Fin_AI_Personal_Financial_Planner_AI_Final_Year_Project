import os
import joblib
import pandas as pd
from django.conf import settings

BASE_DIR = getattr(settings, 'BASE_DIR', os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CLASSIFIER_PATH = os.path.join(BASE_DIR, "transaction_classifier.pkl")
VECTORIZER_PATH = os.path.join(BASE_DIR, "transaction_vectorizer.pkl")

_classifier = None
_vectorizer = None

def get_model_and_vectorizer():
    global _classifier, _vectorizer
    if _classifier is None or _vectorizer is None:
        if os.path.exists(CLASSIFIER_PATH) and os.path.exists(VECTORIZER_PATH):
            try:
                _classifier = joblib.load(CLASSIFIER_PATH)
                _vectorizer = joblib.load(VECTORIZER_PATH)
            except Exception as e:
                _classifier, _vectorizer = None, None
    return _classifier, _vectorizer

def categorize_transaction(description):
    """Categorizes a transaction description using the trained ML model or keyword fallback."""
    if not description:
        return "General"

    clf, vec = get_model_and_vectorizer()
    if clf is not None and vec is not None:
        try:
            X_new = vec.transform([description])
            predicted_category = clf.predict(X_new)[0]
            return predicted_category
        except Exception:
            pass

    # Keyword fallback rule engine
    desc_lower = description.lower()
    if any(k in desc_lower for k in ['swiggy', 'zomato', 'food', 'restaurant', 'dinner', 'lunch', 'cafe', 'pizza', 'burger']):
        return "Food"
    elif any(k in desc_lower for k in ['uber', 'ola', 'cab', 'fuel', 'petrol', 'train', 'flight', 'bus', 'travel']):
        return "Travel"
    elif any(k in desc_lower for k in ['rent', 'electricity', 'water', 'bill', 'recharge', 'wifi', 'internet']):
        return "Bills"
    elif any(k in desc_lower for k in ['amazon', 'flipkart', 'shopping', 'clothes', 'myntra', 'shoes']):
        return "Shopping"
    elif any(k in desc_lower for k in ['salary', 'freelance', 'income', 'bonus', 'paycheck']):
        return "Income"
    elif any(k in desc_lower for k in ['netflix', 'spotify', 'movie', 'cinema', 'game']):
        return "Entertainment"
    
    return "Other"

def update_category(description, correct_category):
    """Updates the model with new data if prediction is incorrect."""
    clf, vec = get_model_and_vectorizer()
    if clf is None or vec is None:
        return "Model files not available for incremental update."

    try:
        df = pd.DataFrame([[description, correct_category]], columns=["description", "category"])
        X_train = vec.transform(df["description"])
        y_train = df["category"]

        if hasattr(clf, 'partial_fit'):
            clf.partial_fit(X_train, y_train, classes=clf.classes_)
            joblib.dump(clf, CLASSIFIER_PATH)
            return f"Model updated with new category: {correct_category}"
    except Exception as e:
        return f"Could not update model: {str(e)}"
    
    return "Model updated."
