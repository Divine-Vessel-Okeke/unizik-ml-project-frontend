// src/app/api/admin/stats/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MSG } from '@/lib/messages';

export const dynamic = 'force-dynamic';

type MLHealthStatus = 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'UNKNOWN';

interface MLHealth {
  status: MLHealthStatus;
  modelStatus: string;
  message: string;
}

// Prefer ML_ENGINE_BASEURL; strip /api/predict from ML_ENGINE_URL as fallback; else localhost default
function getMLBaseUrl(): string {
  const baseUrl = process.env.ML_ENGINE_BASEURL;
  if (baseUrl) return baseUrl.replace(/\/+$/, '');

  const predictUrl = process.env.ML_ENGINE_URL || 'http://127.0.0.1:5000/api/predict';
  return predictUrl.replace(/\/api\/predict\/?$/, '');
}

async function checkMLEngineHealth(): Promise<MLHealth> {
  const healthUrl = `${getMLBaseUrl()}/api/health`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    const response = await fetch(healthUrl, {
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        status: 'OFFLINE',
        modelStatus: 'UNKNOWN',
        message: `HTTP ${response.status} from AI service`,
      };
    }

    const data = await response.json();

    if (data.status === 'Active' && data.model_status === 'Loaded') {
      return {
        status: 'ONLINE',
        modelStatus: 'LOADED',
        message: 'Decision Tree model loaded and responding',
      };
    } else if (data.status === 'Active' && data.model_status === 'Missing Binary') {
      return {
        status: 'DEGRADED',
        modelStatus: 'MISSING',
        message: 'Flask running but .joblib model missing',
      };
    } else {
      return {
        status: 'UNKNOWN',
        modelStatus: data.model_status || 'UNKNOWN',
        message: 'Unexpected health response',
      };
    }
  } catch (err: any) {
    const message =
      err.name === 'AbortError'
        ? 'AI service timeout'
        : err.name === 'SyntaxError'
          ? 'AI service returned invalid JSON response'
          : 'AI service unreachable';
    return {
      status: 'OFFLINE',
      modelStatus: 'UNKNOWN',
      message,
    };
  }
}

export async function GET() {
  try {
    // Fetch transactions and ML health in parallel
    const [transactions, mlHealth] = await Promise.all([
      prisma.transaction.findMany({
        include: { student: true, auditLog: true },
        orderBy: { createdAt: 'desc' }
      }),
      checkMLEngineHealth(),
    ]);

    const totalClearedAmount = transactions
      .filter(t => t.status === 'CLEARED')
      .reduce((sum, t) => sum + t.amount, 0);

    const blockedTransactionCount = await prisma.transaction.count({ where: { status: 'BLOCKED' } });

    // Response keys `totalRevenue` / `fraudCount` are preserved for API compatibility
    // with the admin dashboard client — renaming them requires a coordinated client update.
    return NextResponse.json({
      success: true,
      stats: {
        totalRevenue: totalClearedAmount,
        fraudCount: blockedTransactionCount,
        transactions,
        mlHealth,
      }
    });
  } catch (error: any) {
    console.error('[ADMIN STATS ERROR]:', error.message);
    return NextResponse.json({ success: false, error: MSG.GENERIC_ERROR }, { status: 500 });
  }
}