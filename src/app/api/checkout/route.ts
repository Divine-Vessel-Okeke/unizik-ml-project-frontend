// src/app/api/checkout/route.ts

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { evaluatePaymentTransaction } from '@/lib/fraud-engine';
import { getNetworkRiskScore } from '@/lib/network-risk';   // ← ADD THIS

// Optional per-feature overrides — only honored when isSimulated=true.
// Bounds mirror the Python model's defensive clamps in model_engine.py.
const overrideFeaturesSchema = z.object({
  device_student_count_24h: z.number().int().min(0).max(150).optional(),
  page_dwell_time_seconds: z.number().min(0.1).max(180).optional(),
  is_high_risk_asn: z.number().int().min(0).max(1).optional(),
  failed_attempts_1h: z.number().int().min(0).max(20).optional(),
  session_hardware_mismatch: z.number().int().min(0).max(1).optional(),
  is_off_peak_hour: z.number().int().min(0).max(1).optional(),
}).optional();

const checkoutSchema = z.object({
  studentId: z.string().uuid(),
  invoiceId: z.string().uuid(),
  amount: z.number().positive(),
  reference: z.string().min(6),
  deviceId: z.string().min(8),
  pageDwellTime: z.number().positive(),
  hardwareMismatch: z.number().int().min(0).max(1),
  // NEW: replaces simMode. Declares whether telemetry was observed or overridden.
  isSimulated: z.boolean().optional().default(false),
  overrideFeatures: overrideFeaturesSchema,
});

export async function POST(req: Request) {
  try {
    const headersList = await headers();
    const rawForwarded = headersList.get('x-forwarded-for') || '127.0.0.1';
    const ipAddress = rawForwarded.split(',')[0];

    const body = await req.json();
    console.log('════════════ CHECKOUT ENTRYPOINT ════════════');
    console.log('[CHECKOUT] Raw client payload:', JSON.stringify(body, null, 2));

    const validation = checkoutSchema.safeParse(body);

    if (!validation.success) {
      console.log('[CHECKOUT] VALIDATION FAILED:', validation.error);
      return NextResponse.json({ success: false, error: "Validation Failed", details: validation.error }, { status: 400 });
    }

    const asnNumber = await getNetworkRiskScore(ipAddress);
    console.log('[CHECKOUT] Detected IP:', ipAddress, '→ ASN:', asnNumber);

    const telemetrySource = validation.data.isSimulated ? 'SIMULATED' : 'LIVE';
    console.log('[CHECKOUT] Telemetry source:', telemetrySource,
      validation.data.isSimulated ? '(overrides present)' : '(live observation)');

    const payload = {
      ...validation.data,
      ipAddress,
      asnNumber,
      telemetrySource,
    };

    // 1. FINANCIAL INTEGRITY GUARDRAIL
    const invoice = await prisma.feeInvoice.findUnique({ where: { id: payload.invoiceId } });
    if (!invoice || invoice.studentId !== payload.studentId || invoice.amount !== payload.amount) {
      return NextResponse.json({ success: false, error: "Invalid or Tampered Invoice" }, { status: 403 });
    }
    if (invoice.status === 'PAID') {
      return NextResponse.json({ success: false, error: "This fee invoice has already been cleared and marked as PAID in the university records." }, { status: 400 });
    }

    // 2. DISPATCH TO ML ENGINE
    console.log('[CHECKOUT] Full payload → fraud-engine:', JSON.stringify(payload, null, 2));
    console.log('═══════════════════════════════════════════════');
    const engineResult = await evaluatePaymentTransaction(payload);

    const tx = await prisma.transaction.upsert({
      where: { reference: payload.reference },
      update: {},
      create: {
        invoiceId: payload.invoiceId,
        studentId: payload.studentId,
        amount: payload.amount,
        reference: payload.reference,
        deviceId: payload.deviceId,
        ipAddress: payload.ipAddress,
        asnNumber: payload.asnNumber,
        pageDwellTime: payload.pageDwellTime,
        hardwareMismatch: payload.hardwareMismatch,
        telemetrySource: telemetrySource as any,
        status: engineResult.verdict === 'FRAUDULENT' ? 'BLOCKED' : 'CLEARED'
      }
    });

    if (engineResult.verdict === 'FRAUDULENT') {
      await prisma.feeInvoice.update({
        where: { id: payload.invoiceId },
        data: { status: 'BLOCKED' as any }
      });

      return NextResponse.json({ success: false, message: "Blocked", forensicReport: engineResult }, { status: 403 });
    }

    return NextResponse.json({ success: true, message: "Authorized", data: { id: tx.id } }, { status: 200 });
  } catch (error: any) {
    console.error("[CHECKOUT ROUTE ERROR]:", error.message);
    return NextResponse.json({ success: false, error: "Internal Error" }, { status: 500 });
  }
}