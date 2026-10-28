// src/app/api/telemetry/route.ts

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getNetworkRiskScore } from '@/lib/network-risk';
import { TransactionStatus } from '@prisma/client';

// 60s cache for ASN lookups — prevents panel polling from hammering ip-api.com
const asnCache = new Map<string, { value: number; expiresAt: number }>();
async function getCachedAsn(ip: string): Promise<number> {
  const hit = asnCache.get(ip);
  if (hit && Date.now() < hit.expiresAt) return hit.value;
  const value = await getNetworkRiskScore(ip);
  asnCache.set(ip, { value, expiresAt: Date.now() + 60_000 });
  return value;
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

/**
 * Diagnostic endpoint — returns LIVE values for the 4 server-computable ML features.
 * Client tracks the remaining 2 (page_dwell_time_seconds, session_hardware_mismatch).
 *
 * Polled by the DiagnosticsPanel every 5 seconds.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get('studentId');
    const deviceId = searchParams.get('deviceId');

    if (!studentId || !deviceId) {
      return NextResponse.json(
        { success: false, error: 'studentId and deviceId are required' },
        { status: 400 }
      );
    }

    const headersList = await headers();
    const rawForwarded = headersList.get('x-forwarded-for') || '127.0.0.1';
    const ipAddress = rawForwarded.split(',')[0];

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [distinctStudentsOnDevice, failedAttempts1h, asnNumber] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          deviceId,
          createdAt: { gte: twentyFourHoursAgo },
        },
        select: { studentId: true },
        distinct: ['studentId'],
      }),
      prisma.transaction.count({
        where: {
          OR: [{ studentId }, { deviceId }],
          status: { in: [TransactionStatus.BLOCKED, TransactionStatus.FAILED] },
          createdAt: { gte: oneHourAgo },
        },
      }),
      getCachedAsn(ipAddress),
    ]);

    const hasCurrentStudent = distinctStudentsOnDevice.some(
      (record) => record.studentId === studentId
    );
    const deviceStudentCount24h = distinctStudentsOnDevice.length + (hasCurrentStudent ? 0 : 1);

    return NextResponse.json({
      success: true,
      refreshedAt: new Date().toISOString(),
      features: {
        device_student_count_24h: deviceStudentCount24h,
        failed_attempts_1h: failedAttempts1h,
        is_high_risk_asn: asnNumber,
        is_off_peak_hour: isOffPeakHourWAT(),
      },
    });
  } catch (error: any) {
    console.error('[TELEMETRY ERROR]:', error.message);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch telemetry' },
      { status: 500 }
    );
  }
}