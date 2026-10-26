// src/app/api/admin/velocity/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const transactions = await prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        student: {
          select: { matricNumber: true, firstName: true, lastName: true, department: true }
        }
      }
    });

    const deviceMap = new Map<string, any>();

    for (const tx of transactions) {
      const deviceId = tx.deviceId || "UNKNOWN_COMPUTER";
      
      if (!deviceMap.has(deviceId)) {
        deviceMap.set(deviceId, {
          deviceId,
          totalAttempts: 0,
          clearedCount: 0,
          blockedCount: 0,
          lastActive: tx.createdAt,
          studentsMap: new Map<string, any>()
        });
      }

      const record = deviceMap.get(deviceId);
      record.totalAttempts += 1;
      
      if (tx.status === 'CLEARED') {
        record.clearedCount += 1;
      } else if (tx.status === 'BLOCKED') {
        record.blockedCount += 1;
      }

      if (tx.student) {
        record.studentsMap.set(tx.studentId, {
          matricNumber: tx.student.matricNumber,
          name: `${tx.student.lastName} ${tx.student.firstName}`,
          department: tx.student.department,
          lastStatus: tx.status
        });
      }
    }

    const computers = Array.from(deviceMap.values()).map(item => ({
      deviceId: item.deviceId,
      totalAttempts: item.totalAttempts,
      clearedCount: item.clearedCount,
      blockedCount: item.blockedCount,
      lastActive: item.lastActive,
      studentCount: item.studentsMap.size,
      studentsList: Array.from(item.studentsMap.values())
    }));

    computers.sort((a, b) => b.studentCount - a.studentCount);

    return NextResponse.json({ success: true, computers }, { status: 200 });
  } catch (error: any) {
    console.error("[FETCH COMPUTERS ERROR]:", error.message);
    return NextResponse.json({ success: false, error: "Failed to load computer tracking data." }, { status: 500 });
  }
}