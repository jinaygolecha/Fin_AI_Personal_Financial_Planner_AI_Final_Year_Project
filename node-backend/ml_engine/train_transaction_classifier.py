"""
FinPro — Real Machine Learning Transaction Categorization Training Pipeline
Supervised Multi-Class Classification for Financial Descriptions
Owner: Jinay Golecha (jinay_golecha)
"""

import json
import os
import sys
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, accuracy_score, precision_recall_fscore_support, confusion_matrix
import joblib

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SEED_DATA_PATH = os.path.join(BASE_DIR, 'seed_transactions.json')
MODEL_JOBLIB_PATH = os.path.join(BASE_DIR, 'transaction_classifier.joblib')
ARTIFACTS_JSON_PATH = os.path.join(BASE_DIR, 'model_artifacts.json')

def load_data():
    if not os.path.exists(SEED_DATA_PATH):
        raise FileNotFoundError(f"Seed data not found at {SEED_DATA_PATH}")
    with open(SEED_DATA_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return pd.DataFrame(data)

def train_and_evaluate():
    print("=" * 65)
    print("  FINPRO ML — TRANSACTION CATEGORIZATION TRAINING PIPELINE")
    print("=" * 65)

    df = load_data()
    print(f"[*] Loaded {len(df)} labeled transactions across {df['category'].nunique()} categories.")

    X = df['description'].values
    y = df['category'].values

    # Train / test split (80/20) with stratification
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )
    print(f"[*] Training samples: {len(X_train)} | Test samples: {len(X_test)}")

    # TF-IDF Vectorizer with word and character n-grams
    vectorizer = TfidfVectorizer(
        ngram_range=(1, 2),
        max_features=2500,
        sublinear_tf=True,
        strip_accents='unicode',
        token_pattern=r'(?u)\b\w+\b'
    )
    X_train_vec = vectorizer.fit_transform(X_train)
    X_test_vec = vectorizer.transform(X_test)

    # Supervised Logistic Regression Classifier with balanced class weights
    clf = LogisticRegression(
        C=10.0,
        max_iter=1000,
        class_weight='balanced',
        solver='lbfgs',
        random_state=42
    )
    clf.fit(X_train_vec, y_train)

    # Predictions and Evaluation
    y_pred = clf.predict(X_test_vec)
    acc = accuracy_score(y_test, y_pred)
    p, r, f1, _ = precision_recall_fscore_support(y_test, y_pred, average='weighted', zero_division=0)

    print("\n" + "=" * 65)
    print("  EVALUATION METRICS (TEST SET)")
    print("=" * 65)
    print(f"  • Accuracy:        {acc * 100:.2f}%")
    print(f"  • Precision (wt):  {p * 100:.2f}%")
    print(f"  • Recall (wt):     {r * 100:.2f}%")
    print(f"  • F1-Score (wt):   {f1 * 100:.2f}%")
    print("-" * 65)
    print("\nDetailed Classification Report:")
    print(classification_report(y_test, y_pred, zero_division=0))

    cm = confusion_matrix(y_test, y_pred, labels=clf.classes_)
    print("Confusion Matrix shape:", cm.shape)

    # Save joblib binary
    joblib.dump({'vectorizer': vectorizer, 'classifier': clf, 'classes': clf.classes_}, MODEL_JOBLIB_PATH)
    print(f"\n[+] Saved model binary to: {MODEL_JOBLIB_PATH}")

    # Export portable JSON artifacts for instant in-process Node.js execution
    vocab_clean = {str(k): int(v) for k, v in vectorizer.vocabulary_.items()}
    artifacts = {
        'classes': [str(c) for c in clf.classes_],
        'vocabulary': vocab_clean,
        'idf': [float(x) for x in vectorizer.idf_],
        'coef': [[float(x) for x in c] for c in clf.coef_],
        'intercept': [float(x) for x in clf.intercept_],
        'ngram_range': [1, 2],
        'metrics': {
            'accuracy': float(acc),
            'precision': float(p),
            'recall': float(r),
            'f1_score': float(f1),
            'test_samples': int(len(X_test)),
            'total_samples': int(len(df))
        }
    }
    with open(ARTIFACTS_JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(artifacts, f)
    print(f"[+] Saved portable model artifacts to: {ARTIFACTS_JSON_PATH}")

    print("\n[+] ML Pipeline Training & Evaluation PASSED successfully!")
    return artifacts

if __name__ == '__main__':
    train_and_evaluate()
