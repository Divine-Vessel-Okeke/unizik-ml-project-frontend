// src/app/api/admin/stats/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type MLHealthStatus = 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'UNKNOWN';

interface MLHealth {
  status: MLHealthStatus;
  modelStatus: string;
  message: string;
}

// Prefer ML_ENGINE_BASEURL (already in .env), else derive from ML_ENGINE_URL, else hardcoded localhost
function getMLBaseUrl(): string {
  const baseUrl = process.env.ML_ENGINE_BASEURL;
  if (baseUrl) return baseUrl.replace(/\/+$/, ''); // strip trailing slashes

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
    return {
      status: 'OFFLINE',
      modelStatus: 'UNKNOWN',
      message: err.name === 'AbortError' ? 'AI service timeout' : 'AI service unreachable',
    };
  }
}

export async function GET() {
  try {
    // Run DB query and health check in parallel — don't block dashboard on health timeout
    const [transactions, mlHealth] = await Promise.all([
      prisma.transaction.findMany({
        include: { student: true, auditLog: true },
        orderBy: { createdAt: 'desc' }
      }),
      checkMLEngineHealth(),
    ]);

    const totalRevenue = transactions
      .filter(t => t.status === 'CLEARED')
      .reduce((sum, t) => sum + t.amount, 0);

    const fraudCount = await prisma.transaction.count({ where: { status: 'BLOCKED' } });

    return NextResponse.json({
      success: true,
      stats: { totalRevenue, fraudCount, transactions, mlHealth }
    });
  } catch (error: any) {
    console.error('[ADMIN STATS ERROR]:', error.message);
    return NextResponse.json({ success: false, error: "Failed to fetch admin stats" }, { status: 500 });
  }
}