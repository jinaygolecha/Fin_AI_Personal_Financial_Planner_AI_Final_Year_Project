const prisma = require('../config/database');
const trainingService = require('../services/trainingService');

/**
 * Training Data Bot & ML Studio Controller
 * Jinay Finance AI — Phases 15, 16, 17
 */

/**
 * POST /api/v1/training/datasets/upload
 */
const uploadDataset = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, description, csvContent, fileName } = req.body;

    if (!name || !csvContent) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Dataset name and CSV content are required.' },
      });
    }

    const { headers, rows } = trainingService.parseCSV(csvContent);
    const columns = trainingService.analyzeColumns(headers, rows);

    const dataset = await prisma.$transaction(async (tx) => {
      const ds = await tx.trainingDataset.create({
        data: {
          userId,
          name: name.trim(),
          description: description?.trim() || null,
          fileName: fileName || `${name.toLowerCase().replace(/\s+/g, '_')}.csv`,
          rowCount: rows.length,
          columnCount: headers.length,
          columns,
          currentVersion: 1,
        },
      });

      await tx.datasetVersion.create({
        data: {
          datasetId: ds.id,
          versionNumber: 1,
          changeLog: 'Initial upload',
          rowCount: rows.length,
          columnCount: headers.length,
          columns,
          data: rows,
        },
      });

      return ds;
    });

    return res.status(201).json({
      success: true,
      data: {
        id: dataset.id,
        name: dataset.name,
        rowCount: dataset.rowCount,
        columnCount: dataset.columnCount,
        columns: dataset.columns,
        currentVersion: dataset.currentVersion,
        preview: rows.slice(0, 5),
        message: `Dataset "${dataset.name}" created with ${dataset.rowCount} rows across ${dataset.columnCount} columns.`,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/training/datasets
 */
const getDatasets = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const datasets = await prisma.trainingDataset.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { versions: true, trainingRuns: true },
        },
      },
    });

    return res.status(200).json({
      success: true,
      data: datasets.map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        rowCount: d.rowCount,
        columnCount: d.columnCount,
        currentVersion: d.currentVersion,
        versionsCount: d._count.versions,
        trainingRunsCount: d._count.trainingRuns,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/training/datasets/:id
 */
const getDataset = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const dataset = await prisma.trainingDataset.findFirst({
      where: { id: req.params.id, userId },
      include: {
        versions: {
          select: { id: true, versionNumber: true, changeLog: true, rowCount: true, columnCount: true, createdAt: true },
          orderBy: { versionNumber: 'desc' },
        },
        trainingRuns: {
          select: { id: true, modelVersion: true, algorithm: true, taskType: true, metrics: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!dataset) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Dataset not found.' } });
    }

    // Get preview from current version
    const currentVer = await prisma.datasetVersion.findUnique({
      where: {
        datasetId_versionNumber: { datasetId: dataset.id, versionNumber: dataset.currentVersion },
      },
    });

    const dataArray = Array.isArray(currentVer?.data) ? currentVer.data : [];

    return res.status(200).json({
      success: true,
      data: {
        ...dataset,
        preview: dataArray.slice(0, 10),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/training/datasets/:id/version
 * Safe Dataset Editing with Versioning (Phase 16)
 */
const createDatasetVersion = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { action, changeLog, parameters = {} } = req.body;
    // actions: REMOVE_DUPLICATES, DROP_NULLS, FILL_NULLS, RENAME_COLUMN, FILTER_ROWS

    const dataset = await prisma.trainingDataset.findFirst({
      where: { id: req.params.id, userId },
    });

    if (!dataset) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Dataset not found.' } });
    }

    const currentVer = await prisma.datasetVersion.findUnique({
      where: {
        datasetId_versionNumber: { datasetId: dataset.id, versionNumber: dataset.currentVersion },
      },
    });

    let rows = Array.isArray(currentVer?.data) ? [...currentVer.data] : [];
    let headers = Object.keys(rows[0] || {});

    // Apply transformation
    if (action === 'REMOVE_DUPLICATES') {
      const seen = new Set();
      rows = rows.filter((r) => {
        const key = JSON.stringify(r);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    } else if (action === 'DROP_NULLS') {
      const targetCol = parameters.column;
      rows = rows.filter((r) => {
        if (targetCol) return r[targetCol] !== null && r[targetCol] !== undefined && r[targetCol] !== '';
        return Object.values(r).every((v) => v !== null && v !== undefined && v !== '');
      });
    } else if (action === 'FILL_NULLS') {
      const col = parameters.column;
      const fillVal = parameters.value ?? 0;
      if (col) {
        rows = rows.map((r) => ({
          ...r,
          [col]: r[col] === null || r[col] === undefined || r[col] === '' ? fillVal : r[col],
        }));
      }
    } else if (action === 'RENAME_COLUMN') {
      const { oldName, newName } = parameters;
      if (oldName && newName) {
        rows = rows.map((r) => {
          const row = { ...r };
          row[newName] = row[oldName];
          delete row[oldName];
          return row;
        });
        headers = headers.map((h) => (h === oldName ? newName : h));
      }
    }

    const newColumns = trainingService.analyzeColumns(headers, rows);
    const newVersionNumber = dataset.currentVersion + 1;

    const newVersion = await prisma.$transaction(async (tx) => {
      const ver = await tx.datasetVersion.create({
        data: {
          datasetId: dataset.id,
          versionNumber: newVersionNumber,
          changeLog: changeLog || `Applied ${action}`,
          rowCount: rows.length,
          columnCount: headers.length,
          columns: newColumns,
          data: rows,
        },
      });

      await tx.trainingDataset.update({
        where: { id: dataset.id },
        data: {
          currentVersion: newVersionNumber,
          rowCount: rows.length,
          columnCount: headers.length,
          columns: newColumns,
        },
      });

      return ver;
    });

    return res.status(201).json({
      success: true,
      data: {
        versionNumber: newVersion.versionNumber,
        changeLog: newVersion.changeLog,
        rowCount: newVersion.rowCount,
        columnCount: newVersion.columnCount,
        message: `Created Dataset version v${newVersionNumber} (${rows.length} rows). Original data preserved.`,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/training/datasets/:id
 */
const deleteDataset = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const dataset = await prisma.trainingDataset.findFirst({ where: { id: req.params.id, userId } });
    if (!dataset) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Dataset not found.' } });
    }

    await prisma.trainingDataset.delete({ where: { id: dataset.id } });
    return res.status(200).json({ success: true, data: { message: `Dataset "${dataset.name}" deleted.` } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/training/train
 * Real Model Training & Mathematical Evaluation (Phase 15)
 */
const trainModel = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      datasetId,
      taskType = 'REGRESSION', // REGRESSION | CLASSIFICATION
      targetColumn,
      featureColumns,
      algorithm = 'LINEAR_REGRESSION',
      hyperparameters = {},
    } = req.body;

    if (!datasetId || !targetColumn || !featureColumns || !featureColumns.length) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'datasetId, targetColumn, and featureColumns array are required.' },
      });
    }

    const dataset = await prisma.trainingDataset.findFirst({
      where: { id: datasetId, userId },
    });

    if (!dataset) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Dataset not found.' } });
    }

    const currentVer = await prisma.datasetVersion.findUnique({
      where: {
        datasetId_versionNumber: { datasetId: dataset.id, versionNumber: dataset.currentVersion },
      },
    });

    const allRows = Array.isArray(currentVer?.data) ? currentVer.data : [];
    if (allRows.length < 5) {
      return res.status(400).json({
        success: false,
        error: { code: 'INSUFFICIENT_DATA', message: 'Dataset requires at least 5 clean rows to train and evaluate.' },
      });
    }

    // Filter valid rows where target and features are numeric/valid
    const cleanRows = allRows.filter((r) => {
      const targetVal = r[targetColumn];
      if (targetVal === null || targetVal === undefined || isNaN(Number(targetVal))) return false;
      return featureColumns.every((f) => r[f] !== null && r[f] !== undefined && !isNaN(Number(r[f])));
    });

    if (cleanRows.length < 5) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_DATA', message: 'Not enough rows with numeric target and feature values.' },
      });
    }

    // Train/test 80/20 split
    const splitIndex = Math.floor(cleanRows.length * 0.8);
    const trainData = cleanRows.slice(0, splitIndex);
    const testData = cleanRows.slice(splitIndex);

    const featureStats = trainingService.fitStandardScaler(trainData, featureColumns);

    const XTrain = trainData.map((row) => trainingService.transformFeatures(row, featureColumns, featureStats));
    const yTrain = trainData.map((row) => Number(row[targetColumn]));

    const XTest = testData.map((row) => trainingService.transformFeatures(row, featureColumns, featureStats));
    const yTest = testData.map((row) => Number(row[targetColumn]));

    let modelWeights;
    let metrics;

    if (taskType.toUpperCase() === 'REGRESSION') {
      const l2 = Number(hyperparameters.l2Lambda) || 0.01;
      const lr = Number(hyperparameters.learningRate) || 0.05;
      const epochs = Number(hyperparameters.epochs) || 500;

      modelWeights = trainingService.trainLinearRegression(XTrain, yTrain, l2, epochs, lr);

      // Evaluate on unseen testData
      const yPred = XTest.map((x) => {
        let val = modelWeights.bias;
        for (let j = 0; j < x.length; j++) val += modelWeights.weights[j] * x[j];
        return val;
      });

      metrics = trainingService.evaluateRegression(yTest, yPred);
    } else {
      // Classification
      const lr = Number(hyperparameters.learningRate) || 0.05;
      const epochs = Number(hyperparameters.epochs) || 500;

      modelWeights = trainingService.trainLogisticRegression(XTrain, yTrain, epochs, lr);

      const yPred = XTest.map((x) => {
        let z = modelWeights.bias;
        for (let j = 0; j < x.length; j++) z += modelWeights.weights[j] * x[j];
        return trainingService.sigmoid(z) >= 0.5 ? 1 : 0;
      });

      metrics = trainingService.evaluateClassification(yTest, yPred);
    }

    // Generate version string based on existing runs
    const existingCount = await prisma.trainingRun.count({ where: { datasetId } });
    const modelVersion = `v1.${existingCount}.0`;

    const run = await prisma.trainingRun.create({
      data: {
        userId,
        datasetId,
        datasetVersionId: currentVer.id,
        taskType: taskType.toUpperCase(),
        targetColumn,
        featureColumns,
        algorithm: algorithm.toUpperCase(),
        hyperparameters,
        metrics,
        modelVersion,
        status: 'COMPLETED',
        modelWeights,
        featureStats,
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        id: run.id,
        modelVersion: run.modelVersion,
        taskType: run.taskType,
        algorithm: run.algorithm,
        metrics: run.metrics,
        trainSamplesCount: trainData.length,
        validationSamplesCount: testData.length,
        createdAt: run.createdAt,
        message: `Model ${run.modelVersion} trained successfully using ${run.algorithm} with real validation metrics.`,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/training/runs
 */
const getTrainingRuns = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { datasetId } = req.query;

    const runs = await prisma.trainingRun.findMany({
      where: { userId, ...(datasetId && { datasetId }) },
      orderBy: { createdAt: 'desc' },
      include: {
        dataset: { select: { name: true } },
        _count: { select: { predictions: true } },
      },
    });

    return res.status(200).json({
      success: true,
      data: runs.map((r) => ({
        id: r.id,
        datasetName: r.dataset.name,
        modelVersion: r.modelVersion,
        algorithm: r.algorithm,
        taskType: r.taskType,
        targetColumn: r.targetColumn,
        featureColumns: r.featureColumns,
        metrics: r.metrics,
        predictionsCount: r._count.predictions,
        status: r.status,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/training/predict
 * Production Prediction with Transparency & Validation (Phase 17)
 */
const predict = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { trainingRunId, inputs } = req.body;

    if (!trainingRunId || !inputs || typeof inputs !== 'object') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'trainingRunId and inputs object are required.' },
      });
    }

    const run = await prisma.trainingRun.findFirst({
      where: { id: trainingRunId, userId },
      include: { dataset: { select: { name: true } } },
    });

    if (!run) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Trained model not found.' } });
    }

    const { modelWeights, featureStats, featureColumns, taskType, metrics } = run;

    // Validate inputs contain all expected features
    const missingFeatures = featureColumns.filter((f) => inputs[f] === undefined || inputs[f] === null || isNaN(Number(inputs[f])));
    if (missingFeatures.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FEATURES',
          message: `Missing required numeric input values for: ${missingFeatures.join(', ')}`,
        },
      });
    }

    // Preprocessing: standard scaling
    const normalizedInput = trainingService.transformFeatures(inputs, featureColumns, featureStats);

    let predictedValue;
    let numericPrediction;
    let confidenceScore = null;

    if (taskType === 'REGRESSION') {
      let result = modelWeights.bias;
      for (let i = 0; i < normalizedInput.length; i++) {
        result += (modelWeights.weights[i] || 0) * normalizedInput[i];
      }
      numericPrediction = Math.round(result * 100) / 100;
      predictedValue = String(numericPrediction);
      confidenceScore = metrics?.r2 !== undefined ? Math.max(0, metrics.r2) : null;
    } else {
      let z = modelWeights.bias;
      for (let i = 0; i < normalizedInput.length; i++) {
        z += (modelWeights.weights[i] || 0) * normalizedInput[i];
      }
      const prob = trainingService.sigmoid(z);
      confidenceScore = Math.round(Math.max(prob, 1 - prob) * 1000) / 1000;
      numericPrediction = prob >= 0.5 ? 1 : 0;
      predictedValue = prob >= 0.5 ? 'Positive / 1' : 'Negative / 0';
    }

    // Store in history
    const savedPrediction = await prisma.mLPrediction.create({
      data: {
        userId,
        trainingRunId: run.id,
        modelVersion: run.modelVersion,
        algorithm: run.algorithm,
        inputValues: inputs,
        predictedValue,
        numericPrediction,
        confidenceScore,
        performanceSummary: metrics,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        id: savedPrediction.id,
        modelVersion: run.modelVersion,
        algorithm: run.algorithm,
        datasetName: run.dataset.name,
        targetColumn: run.targetColumn,
        inputs,
        predictedValue,
        numericPrediction,
        confidenceScore,
        modelEvaluationMetrics: metrics,
        timestamp: savedPrediction.createdAt,
        disclaimer: 'This statistical prediction is generated based on mathematical training data patterns. Past patterns do not guarantee future financial results.',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/training/predictions
 */
const getPredictionHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const predictions = await prisma.mLPrediction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return res.status(200).json({
      success: true,
      data: predictions,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadDataset,
  getDatasets,
  getDataset,
  createDatasetVersion,
  deleteDataset,
  trainModel,
  getTrainingRuns,
  predict,
  getPredictionHistory,
};
