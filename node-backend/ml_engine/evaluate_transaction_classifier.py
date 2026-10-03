"""
FinPro — Real ML Transaction Classifier Evaluation Script
Evaluates model performance and outputs precision, recall, F1, and confusion matrix
"""

import os
import json
from train_transaction_classifier import train_and_evaluate

if __name__ == '__main__':
    artifacts = train_and_evaluate()
    metrics = artifacts.get('metrics', {})
    print("\nFinal Evaluated Metrics Summary:")
    print(json.dumps(metrics, indent=2))
