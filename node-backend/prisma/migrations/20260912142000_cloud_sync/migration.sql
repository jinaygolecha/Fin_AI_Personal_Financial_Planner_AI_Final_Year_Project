-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('CREDIT', 'DEBIT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AssetType" ADD VALUE 'SILVER';
ALTER TYPE "AssetType" ADD VALUE 'FIXED_DEPOSIT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'GOLD_ALERT';
ALTER TYPE "NotificationType" ADD VALUE 'SILVER_ALERT';
ALTER TYPE "NotificationType" ADD VALUE 'ANOMALY_DETECTED';
ALTER TYPE "NotificationType" ADD VALUE 'CASH_FLOW_ALERT';
ALTER TYPE "NotificationType" ADD VALUE 'SIMULATION_RESULT';

-- AlterTable
ALTER TABLE "insurance_policies" ADD COLUMN     "beneficiary" TEXT,
ADD COLUMN     "policyNumber" TEXT;

-- CreateTable
CREATE TABLE "ai_recommendation_feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recommendationId" TEXT,
    "recommendationTitle" TEXT NOT NULL,
    "feedbackType" TEXT NOT NULL,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_recommendation_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_health_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "savingsScore" INTEGER NOT NULL DEFAULT 0,
    "debtScore" INTEGER NOT NULL DEFAULT 0,
    "emergencyScore" INTEGER NOT NULL DEFAULT 0,
    "investmentScore" INTEGER NOT NULL DEFAULT 0,
    "goalScore" INTEGER NOT NULL DEFAULT 0,
    "insuranceScore" INTEGER NOT NULL DEFAULT 0,
    "cashFlowScore" INTEGER NOT NULL DEFAULT 0,
    "subscriptionScore" INTEGER NOT NULL DEFAULT 0,
    "dtiScore" INTEGER NOT NULL DEFAULT 0,
    "incomeStabilityScore" INTEGER NOT NULL DEFAULT 0,
    "positiveReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attentionReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommendations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_health_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_flow_predictions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timeframeDays" INTEGER NOT NULL,
    "expectedIncome" DECIMAL(15,2) NOT NULL,
    "expectedExpenses" DECIMAL(15,2) NOT NULL,
    "expectedBalance" DECIMAL(15,2) NOT NULL,
    "lowBalanceDate" TIMESTAMP(3),
    "lowBalanceAmount" DECIMAL(15,2),
    "projections" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_flow_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_anomalies" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "transactionId" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "category" TEXT NOT NULL,
    "merchant" TEXT,
    "baselineAverage" DECIMAL(15,2) NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'UNUSUAL',
    "reason" TEXT NOT NULL,
    "userFeedback" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_anomalies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_simulations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scenarioName" TEXT NOT NULL,
    "scenarioType" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "currentCashFlow" DECIMAL(15,2) NOT NULL,
    "scenarioCashFlow" DECIMAL(15,2) NOT NULL,
    "currentNetWorth" DECIMAL(15,2) NOT NULL,
    "scenarioNetWorth" DECIMAL(15,2) NOT NULL,
    "impactSummary" TEXT NOT NULL,
    "detailedImpact" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_simulations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_category_corrections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "merchant" TEXT,
    "description" TEXT,
    "originalCategory" TEXT NOT NULL,
    "correctedCategory" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_category_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_scans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "merchant" TEXT,
    "amount" DECIMAL(15,2),
    "date" DATE,
    "category" TEXT,
    "items" JSONB,
    "rawText" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipt_scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_price_history" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "price" DECIMAL(15,2) NOT NULL,
    "open" DECIMAL(15,2),
    "high" DECIMAL(15,2),
    "low" DECIMAL(15,2),
    "close" DECIMAL(15,2),
    "volume" BIGINT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "provider" TEXT NOT NULL DEFAULT 'Finnhub',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commodity_prices" (
    "id" TEXT NOT NULL,
    "commodityType" TEXT NOT NULL,
    "pricePerGram" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "provider" TEXT NOT NULL DEFAULT 'MCX_Reference',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commodity_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_datasets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "fileName" TEXT,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "columnCount" INTEGER NOT NULL DEFAULT 0,
    "columns" JSONB NOT NULL DEFAULT '[]',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_datasets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dataset_versions" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "changeLog" TEXT NOT NULL DEFAULT 'Initial upload',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "columnCount" INTEGER NOT NULL DEFAULT 0,
    "columns" JSONB NOT NULL DEFAULT '[]',
    "data" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dataset_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_runs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "datasetVersionId" TEXT,
    "taskType" TEXT NOT NULL,
    "targetColumn" TEXT NOT NULL,
    "featureColumns" TEXT[],
    "algorithm" TEXT NOT NULL,
    "hyperparameters" JSONB NOT NULL DEFAULT '{}',
    "metrics" JSONB NOT NULL,
    "modelVersion" TEXT NOT NULL DEFAULT 'v1.0.0',
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "errorMessage" TEXT,
    "modelWeights" JSONB,
    "featureStats" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ml_predictions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trainingRunId" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "inputValues" JSONB NOT NULL,
    "predictedValue" TEXT NOT NULL,
    "numericPrediction" DOUBLE PRECISION,
    "confidenceScore" DOUBLE PRECISION,
    "performanceSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ml_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_cards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardNickname" TEXT NOT NULL,
    "cardType" "CardType" NOT NULL DEFAULT 'CREDIT',
    "issuer" TEXT NOT NULL,
    "lastFourDigits" TEXT NOT NULL,
    "creditLimit" DECIMAL(15,2),
    "outstandingAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "minimumDue" DECIMAL(15,2),
    "billingCycleDay" INTEGER,
    "dueDate" DATE,
    "rewardCategory" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_tasks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "dueDate" DATE NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "reminderTime" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_recommendation_feedback_userId_idx" ON "ai_recommendation_feedback"("userId");

-- CreateIndex
CREATE INDEX "financial_health_history_userId_createdAt_idx" ON "financial_health_history"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "cash_flow_predictions_userId_idx" ON "cash_flow_predictions"("userId");

-- CreateIndex
CREATE INDEX "expense_anomalies_userId_idx" ON "expense_anomalies"("userId");

-- CreateIndex
CREATE INDEX "financial_simulations_userId_idx" ON "financial_simulations"("userId");

-- CreateIndex
CREATE INDEX "transaction_category_corrections_userId_idx" ON "transaction_category_corrections"("userId");

-- CreateIndex
CREATE INDEX "receipt_scans_userId_idx" ON "receipt_scans"("userId");

-- CreateIndex
CREATE INDEX "market_price_history_symbol_timestamp_idx" ON "market_price_history"("symbol", "timestamp");

-- CreateIndex
CREATE INDEX "commodity_prices_commodityType_timestamp_idx" ON "commodity_prices"("commodityType", "timestamp");

-- CreateIndex
CREATE INDEX "training_datasets_userId_idx" ON "training_datasets"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "dataset_versions_datasetId_versionNumber_key" ON "dataset_versions"("datasetId", "versionNumber");

-- CreateIndex
CREATE INDEX "training_runs_userId_idx" ON "training_runs"("userId");

-- CreateIndex
CREATE INDEX "training_runs_datasetId_idx" ON "training_runs"("datasetId");

-- CreateIndex
CREATE INDEX "ml_predictions_userId_idx" ON "ml_predictions"("userId");

-- CreateIndex
CREATE INDEX "ml_predictions_trainingRunId_idx" ON "ml_predictions"("trainingRunId");

-- CreateIndex
CREATE INDEX "payment_cards_userId_idx" ON "payment_cards"("userId");

-- CreateIndex
CREATE INDEX "financial_tasks_userId_idx" ON "financial_tasks"("userId");

-- CreateIndex
CREATE INDEX "financial_tasks_userId_isCompleted_idx" ON "financial_tasks"("userId", "isCompleted");

-- AddForeignKey
ALTER TABLE "ai_recommendation_feedback" ADD CONSTRAINT "ai_recommendation_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_health_history" ADD CONSTRAINT "financial_health_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_flow_predictions" ADD CONSTRAINT "cash_flow_predictions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_anomalies" ADD CONSTRAINT "expense_anomalies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_simulations" ADD CONSTRAINT "financial_simulations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_category_corrections" ADD CONSTRAINT "transaction_category_corrections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_scans" ADD CONSTRAINT "receipt_scans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_datasets" ADD CONSTRAINT "training_datasets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dataset_versions" ADD CONSTRAINT "dataset_versions_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "training_datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_runs" ADD CONSTRAINT "training_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_runs" ADD CONSTRAINT "training_runs_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "training_datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_runs" ADD CONSTRAINT "training_runs_datasetVersionId_fkey" FOREIGN KEY ("datasetVersionId") REFERENCES "dataset_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ml_predictions" ADD CONSTRAINT "ml_predictions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ml_predictions" ADD CONSTRAINT "ml_predictions_trainingRunId_fkey" FOREIGN KEY ("trainingRunId") REFERENCES "training_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_cards" ADD CONSTRAINT "payment_cards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_tasks" ADD CONSTRAINT "financial_tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

