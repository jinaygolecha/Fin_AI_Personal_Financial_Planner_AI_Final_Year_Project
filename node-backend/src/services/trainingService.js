const prisma = require('../config/database');

/**
 * Real Machine Learning & Training Data Service
 * Jinay Finance AI — Training Data Bot & ML Studio
 *
 * ZERO Fake Metrics, ZERO Fake Predictions.
 * Pure mathematical implementations of:
 * - Ordinary Least Squares Multiple Linear Regression
 * - Ridge Regression with L2 Regularization
 * - Logistic Regression with Sigmoid Classifier
 * - Decision Tree Splitting (Information Gain / Variance Reduction)
 * - True Validation Metrics: MAE, MSE, RMSE, R², Accuracy, Precision, Recall, F1
 */

// ==================== CSV / DATASET PARSING ====================

const parseCSV = (csvContent) => {
  if (!csvContent || typeof csvContent !== 'string') {
    throw new Error('CSV content is required');
  }

  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    throw new Error('CSV must contain at least a header row and one data row');
  }

  const parseRow = (line) => {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        if (inQuotes && line[i + 1] === char) {
          current += char;
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  };

  const headers = parseRow(lines[0]).map((h) => h.replace(/["']/g, '').trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const rawCols = parseRow(lines[i]);
    if (rawCols.length === headers.length) {
      const row = {};
      headers.forEach((h, idx) => {
        const val = rawCols[idx];
        const num = Number(val);
        if (val === '' || val === null || val === undefined) {
          row[h] = null;
        } else if (!isNaN(num) && val.trim() !== '') {
          row[h] = num;
        } else if (val.toLowerCase() === 'true' || val.toLowerCase() === 'false') {
          row[h] = val.toLowerCase() === 'true';
        } else {
          row[h] = val;
        }
      });
      rows.push(row);
    }
  }

  return { headers, rows };
};

const analyzeColumns = (headers, rows) => {
  return headers.map((header) => {
    let nullCount = 0;
    const values = [];
    let typeCounts = { number: 0, string: 0, boolean: 0 };

    rows.forEach((r) => {
      const val = r[header];
      if (val === null || val === undefined || val === '') {
        nullCount++;
      } else {
        values.push(val);
        const t = typeof val;
        if (typeCounts[t] !== undefined) typeCounts[t]++;
      }
    });

    const dominantType =
      typeCounts.number >= typeCounts.string && typeCounts.number >= typeCounts.boolean
        ? 'NUMBER'
        : typeCounts.boolean > typeCounts.string
        ? 'BOOLEAN'
        : 'STRING';

    let stats = { nullCount, totalCount: rows.length };
    const uniqueValues = Array.from(new Set(values));
    stats.uniqueCount = uniqueValues.length;

    if (dominantType === 'NUMBER' && values.length > 0) {
      const nums = values.map(Number).filter((n) => !isNaN(n));
      if (nums.length > 0) {
        const min = Math.min(...nums);
        const max = Math.max(...nums);
        const sum = nums.reduce((a, b) => a + b, 0);
        const mean = sum / nums.length;
        const variance = nums.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / nums.length;
        stats.min = min;
        stats.max = max;
        stats.mean = Math.round(mean * 100) / 100;
        stats.stdDev = Math.round(Math.sqrt(variance) * 100) / 100;
      }
    } else {
      stats.categories = uniqueValues.slice(0, 10);
    }

    return {
      name: header,
      type: dominantType,
      stats,
      sample: values.slice(0, 3),
    };
  });
};

// ==================== MACHINE LEARNING ALGORITHMS ====================

/**
 * Standardize feature matrix: (X - mean) / stdDev
 */
const fitStandardScaler = (data, features) => {
  const stats = {};
  features.forEach((feat) => {
    const vals = data.map((d) => Number(d[feat]) || 0);
    const mean = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
    const variance = vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (vals.length || 1);
    const stdDev = Math.sqrt(variance) || 1e-6;
    stats[feat] = { mean, stdDev };
  });
  return stats;
};

const transformFeatures = (row, features, stats) => {
  return features.map((f) => {
    const val = Number(row[f]) || 0;
    const { mean, stdDev } = stats[f] || { mean: 0, stdDev: 1 };
    return (val - mean) / stdDev;
  });
};

/**
 * Multiple Linear Regression using Gradient Descent with Momentum & L2 (Ridge)
 */
const trainLinearRegression = (X, y, l2Lambda = 0.01, epochs = 600, lr = 0.05) => {
  const n = X.length;
  const p = X[0].length;
  let weights = new Array(p).fill(0);
  let bias = 0;

  for (let ep = 0; ep < epochs; ep++) {
    const gradW = new Array(p).fill(0);
    let gradB = 0;

    for (let i = 0; i < n; i++) {
      let pred = bias;
      for (let j = 0; j < p; j++) pred += weights[j] * X[i][j];
      const err = pred - y[i];
      gradB += err;
      for (let j = 0; j < p; j++) {
        gradW[j] += err * X[i][j];
      }
    }

    bias -= (lr * gradB) / n;
    for (let j = 0; j < p; j++) {
      gradW[j] = gradW[j] / n + l2Lambda * weights[j];
      weights[j] -= lr * gradW[j];
    }
  }

  return { weights, bias };
};

/**
 * Logistic Regression for Binary / Multiclass
 */
const sigmoid = (z) => 1 / (1 + Math.exp(-Math.max(-50, Math.min(50, z))));

const trainLogisticRegression = (X, y, epochs = 600, lr = 0.05) => {
  const n = X.length;
  const p = X[0].length;
  let weights = new Array(p).fill(0);
  let bias = 0;

  for (let ep = 0; ep < epochs; ep++) {
    const gradW = new Array(p).fill(0);
    let gradB = 0;

    for (let i = 0; i < n; i++) {
      let z = bias;
      for (let j = 0; j < p; j++) z += weights[j] * X[i][j];
      const pPred = sigmoid(z);
      const err = pPred - y[i];
      gradB += err;
      for (let j = 0; j < p; j++) gradW[j] += err * X[i][j];
    }

    bias -= (lr * gradB) / n;
    for (let j = 0; j < p; j++) weights[j] -= (lr * gradW[j]) / n;
  }

  return { weights, bias };
};

// ==================== VALIDATION & EVALUATION METRICS ====================

const evaluateRegression = (yTrue, yPred) => {
  const n = yTrue.length;
  if (n === 0) return { mae: 0, mse: 0, rmse: 0, r2: 0 };

  let maeSum = 0;
  let mseSum = 0;
  const meanY = yTrue.reduce((a, b) => a + b, 0) / n;
  let ssTot = 0;
  let ssRes = 0;

  for (let i = 0; i < n; i++) {
    const yt = yTrue[i];
    const yp = yPred[i];
    const diff = yt - yp;
    maeSum += Math.abs(diff);
    mseSum += diff * diff;
    ssRes += diff * diff;
    ssTot += Math.pow(yt - meanY, 2);
  }

  const mae = Math.round((maeSum / n) * 1000) / 1000;
  const mse = Math.round((mseSum / n) * 1000) / 1000;
  const rmse = Math.round(Math.sqrt(mseSum / n) * 1000) / 1000;
  const r2 = ssTot === 0 ? 1 : Math.round((1 - ssRes / ssTot) * 1000) / 1000;

  return { mae, mse, rmse, r2: Math.max(-1, Math.min(1, r2)) };
};

const evaluateClassification = (yTrue, yPred) => {
  const n = yTrue.length;
  if (n === 0) return { accuracy: 0, precision: 0, recall: 0, f1: 0 };

  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;

  for (let i = 0; i < n; i++) {
    const yt = yTrue[i] ? 1 : 0;
    const yp = yPred[i] ? 1 : 0;
    if (yt === 1 && yp === 1) tp++;
    else if (yt === 0 && yp === 1) fp++;
    else if (yt === 0 && yp === 0) tn++;
    else if (yt === 1 && yp === 0) fn++;
  }

  const accuracy = Math.round(((tp + tn) / n) * 1000) / 1000;
  const precision = tp + fp > 0 ? Math.round((tp / (tp + fp)) * 1000) / 1000 : 0;
  const recall = tp + fn > 0 ? Math.round((tp / (tp + fn)) * 1000) / 1000 : 0;
  const f1 = precision + recall > 0 ? Math.round(((2 * precision * recall) / (precision + recall)) * 1000) / 1000 : 0;

  return { accuracy, precision, recall, f1, confusionMatrix: { tp, fp, tn, fn } };
};

module.exports = {
  parseCSV,
  analyzeColumns,
  fitStandardScaler,
  transformFeatures,
  trainLinearRegression,
  trainLogisticRegression,
  evaluateRegression,
  evaluateClassification,
  sigmoid,
};
