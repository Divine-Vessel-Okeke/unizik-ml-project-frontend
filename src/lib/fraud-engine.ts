// src/lib/fraud-engine.ts

import { prisma } from './prisma';
import { TransactionStatus } from '@prisma/client';

export interface PaymentInitiationRequest {
  studentId: string;
  invoiceId: string;
  amount: number;
  reference: string;
  deviceId: string;
  ipAddress: string;
  asnNumber: number;
  pageDwellTime: number;
  hardwareMismatch: number;
  telemetrySource: 'LIVE' | 'SIMULATED' | 'UNSPECIFIED';
  overrideFeatures?: {
    device_student_count_24h?: number;
    page_dwell_time_seconds?: number;
    is_high_risk_asn?: number;
    failed_attempts_1h?: number;
    session_hardware_mismatch?: number;
    is_off_peak_hour?: number;
  };
}

export interface FraudEngineResponse {
  success: boolean;
  transactionId: string;
  reference: string;
  status: TransactionStatus;
  verdict: 'LEGITIMATE' | 'FRAUDULENT';
  confidence: number;
  explanation: string;
  telemetrySource: 'LIVE' | 'SIMULATED' | 'UNSPECIFIED';
}

function isOffPeakHourWAT(): number {
  const now = new Date();
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();

  let watHours = utcHours + 1;
  if (watHours >= 24) watHours -= 24;

  if (watHours >= 1 && watHours < 4) return 1;
  if (watHours === 4 && utcMinutes <= 30) return 1;
  return 0;
}

export async function evaluatePaymentTransaction(
  payload: PaymentInitiationRequest
): Promise<FraudEngineResponse> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  try {
    // 1. DATABASE AGGREGATION
    const distinctStudentsOnDevice = await prisma.transaction.findMany({
      where: {
        deviceId: payload.deviceId,
        createdAt: { gte: twentyFourHoursAgo },
      },
      select: { studentId: true },
      distinct: ['studentId'],
    });

    const hasCurrentStudent = distinctStudentsOnDevice.some(
      (record) => record.studentId === payload.studentId
    );
    let deviceStudentCount24h = distinctStudentsOnDevice.length + (hasCurrentStudent ? 0 : 1);

    let failedAttempts1h = await prisma.transaction.count({
      where: {
        OR: [{ studentId: payload.studentId }, { deviceId: payload.deviceId }],
        status: { in: [TransactionStatus.BLOCKED, TransactionStatus.FAILED] },
        createdAt: { gte: oneHourAgo },
      },
    });

    let targetDwellTime = payload.pageDwellTime;
    let targetAsn = payload.asnNumber;
    let targetMismatch = payload.hardwareMismatch;
    let offPeakFlag = isOffPeakHourWAT();

    // 2. APPLY EXPLICIT OVERRIDES (only when marked SIMULATED)
    if (payload.telemetrySource === 'SIMULATED' && payload.overrideFeatures) {
      const o = payload.overrideFeatures;
      if (o.device_student_count_24h !== undefined) deviceStudentCount24h = o.device_student_count_24h;
      if (o.page_dwell_time_seconds !== undefined) targetDwellTime = o.page_dwell_time_seconds;
      if (o.is_high_risk_asn !== undefined) targetAsn = o.is_high_risk_asn;
      if (o.failed_attempts_1h !== undefined) failedAttempts1h = o.failed_attempts_1h;
      if (o.session_hardware_mismatch !== undefined) targetMismatch = o.session_hardware_mismatch;
      if (o.is_off_peak_hour !== undefined) offPeakFlag = o.is_off_peak_hour;

      console.log('[FRAUD-ENGINE] SIMULATED mode — applied overrides:', JSON.stringify(o));
    }

    console.log("───── FRAUD ENGINE ENTRYPOINT ─────");
    console.log("[FRAUD-ENGINE] Received payload:", JSON.stringify(payload, null, 2));
    console.log("[FRAUD-ENGINE] Final feature vector:", {
      telemetrySource: payload.telemetrySource,
      deviceStudentCount24h,
      failedAttempts1h,
      targetDwellTime,
      targetAsn,
      targetMismatch,
      offPeakFlag,
    });

    // 3. CONSTRUCT THE ML FEATURE VECTOR
    const mlPayload = {
      device_student_count_24h: deviceStudentCount24h,
      page_dwell_time_seconds: targetDwellTime,
      is_high_risk_asn: targetAsn,
      failed_attempts_1h: failedAttempts1h,
      session_hardware_mismatch: targetMismatch,
      is_off_peak_hour: offPeakFlag,
    };

    console.log("--------------------------------------------------");
    console.log(`[TELEMETRY (${payload.telemetrySource})] Sending 6-param vector to Python AI:`);
    console.log(JSON.stringify(mlPayload, null, 2));
    console.log("--------------------------------------------------");

    // 4. DISPATCH TO PYTHON FLASK MICROSERVICE — NO FALLBACK
    const mlEndpoint = process.env.ML_ENGINE_URL || 'http://127.0.0.1:5000/api/predict';
    let aiVerdict: 'LEGITIMATE' | 'FRAUDULENT';
    let aiConfidence: number;
    let aiExplanation: string;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(mlEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mlPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`AI engine responded with HTTP ${response.status}`);
      }

      const mlResult = await response.json();

      if (mlResult.status !== 'success') {
        throw new Error(mlResult.message || 'AI engine returned non-success status.');
      }

      if (mlResult.verdict !== 'LEGITIMATE' && mlResult.verdict !== 'FRAUDULENT') {
        throw new Error(`AI engine returned invalid verdict: ${mlResult.verdict}`);
      }

      aiVerdict = mlResult.verdict;
      aiConfidence = mlResult.confidence;
      aiExplanation = mlResult.explanation;
    } catch (mlError: any) {
      console.error('[FRAUD ENGINE] AI Microservice unavailable:', mlError.message);
      throw new Error(`AI_ENGINE_UNAVAILABLE: ${mlError.message}`);
    }

    // 5. ATOMIC TRANSACTION WRITE
    const targetStatus: TransactionStatus =
      aiVerdict === 'FRAUDULENT' ? TransactionStatus.BLOCKED : TransactionStatus.CLEARED;

    const createdTransaction = await prisma.$transaction(async (tx) => {
      const txn = await tx.transaction.create({
        data: {
          reference: payload.reference,
          invoiceId: payload.invoiceId,
          studentId: payload.studentId,
          amount: payload.amount,
          status: targetStatus,
          deviceId: payload.deviceId,
          ipAddress: payload.ipAddress,
          asnNumber: targetAsn,
          pageDwellTime: targetDwellTime,
          isOffPeak: offPeakFlag,
          hardwareMismatch: targetMismatch,
          telemetrySource: payload.telemetrySource as any,
        },
      });

      if (aiVerdict === 'FRAUDULENT') {
        await tx.fraudAuditLog.create({
          data: {
            transactionId: txn.id,
            studentId: payload.studentId,
            prediction: 1,
            confidence: aiConfidence,
            explanation: aiExplanation,
            verdict: aiVerdict,
          },
        });
      }

      if (targetStatus === TransactionStatus.CLEARED) {
        await tx.feeInvoice.update({
          where: { id: payload.invoiceId },
          data: { status: 'PAID' },
        });
      }

      return txn;
    });

    console.log("[FRAUD-ENGINE] Final transaction write:", {
      transactionId: createdTransaction.id,
      status: targetStatus,
      verdict: aiVerdict,
      telemetrySource: payload.telemetrySource,
      hardwareMismatch: targetMismatch,
      asnNumber: targetAsn,
      pageDwellTime: targetDwellTime,
      isOffPeak: offPeakFlag,
    });
    console.log("────────────────────────────────────");

    return {
      success: targetStatus === TransactionStatus.CLEARED,
      transactionId: createdTransaction.id,
      reference: createdTransaction.reference,
      status: createdTransaction.status,
      verdict: aiVerdict,
      confidence: aiConfidence,
      explanation: aiExplanation,
      telemetrySource: payload.telemetrySource,
    };
  } catch (error: any) {
    console.error('[FRAUD ENGINE FATAL] Transaction processing failed:', error.message);
    throw error;
  }
}