"""
FinPro — Real ML Transaction Prediction CLI
Predicts transaction category with confidence score
"""

import sys
import os
import json
import joblib

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_JOBLIB_PATH = os.path.join(BASE_DIR, 'transaction_classifier.joblib')

def predict(description, amount=0.0):
    if not os.path.exists(MODEL_JOBLIB_PATH):
        # Fallback to train first if not found
        from train_transaction_classifier import train_and_evaluate
        train_and_evaluate()

    bundle = joblib.load(MODEL_JOBLIB_PATH)
    vectorizer = bundle['vectorizer']
    classifier = bundle['classifier']

    X_vec = vectorizer.transform([description])
    probs = classifier.predict_proba(X_vec)[0]
    best_idx = probs.argmax()
    category = classifier.classes_[best_idx]
    confidence = float(probs[best_idx])

    # If confidence is below threshold, flag as Needs Review
    status = "HIGH_CONFIDENCE" if confidence >= 0.60 else "NEEDS_REVIEW"

    return {
        "description": description,
        "amount": amount,
        "category": category if confidence >= 0.50 else "Needs Review",
        "predictedCategory": category,
        "confidence": round(confidence * 100, 1),
        "status": status,
        "classes": [
            {"category": cls, "prob": round(float(p) * 100, 1)}
            for cls, p in sorted(zip(classifier.classes_, probs), key=lambda x: x[1], reverse=True)[:3]
        ]
    }

if __name__ == '__main__':
    desc = sys.argv[1] if len(sys.argv) > 1 else "Swiggy order dinner"
    amt = float(sys.argv[2]) if len(sys.argv) > 2 else 500.0
    res = predict(desc, amt)
    print(json.dumps(res, indent=2))
