// src/app/api/checkout/route.ts

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { evaluatePaymentTransaction } from '@/lib/fraud-engine';

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

/**
 * PRODUCTION NETWORK DETECTOR
 * Detects if the user is on a Nigerian Telco (MTN, Glo, Airtel, 9Mobile).
 * If not, flags as high risk (asnNumber = 1).
 */
async function getNetworkRiskScore(rawIp: string): Promise<number> {
  const ip = (rawIp || '').trim().toLowerCase();

  console.log('[NETWORK] Raw x-forwarded-for:', JSON.stringify(rawIp));
  console.log('[NETWORK] Normalized IP:', JSON.stringify(ip));

  const isLocalOrPrivate =
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip === 'localhost' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('::ffff:192.168.') ||
    ip.startsWith('10.') ||
    ip.startsWith('::ffff:10.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('::ffff:172.16.');

  if (isLocalOrPrivate) {
    console.log('[NETWORK] Local/private IP detected → ASN risk = 0 (SAFE)');
    return 0;
  }

  console.log('[NETWORK] External IP → querying ip-api.com for:', ip);

  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,isp,query`);
    const data = await response.json();

    if (data.status !== "success") {
      console.log('[NETWORK] ip-api.com failed → defaulting to HIGH RISK (1)');
      return 1;
    }

    const ispName = (data.isp || '').toUpperCase();
    const telcos = ["MTN", "GLOBACOM", "AIRTEL", "9MOBILE", "ETISALAT"];
    const isLocalTelco = telcos.some(telco => ispName.includes(telco));

    const result = isLocalTelco ? 0 : 1;
    console.log('[NETWORK] ISP:', ispName, '→ ASN risk =', result, isLocalTelco ? '(local telco)' : '(foreign/unknown)');
    return result;
  } catch (e) {
    console.error("[NETWORK DETECTION ERROR]", e);
    return 1;
  }
}

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