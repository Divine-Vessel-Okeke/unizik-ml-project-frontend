// src/app/api/admin/velocity/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MSG } from '@/lib/messages';

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
      const deviceId = tx.deviceId || "UNKNOWN_DEVICE";

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
        // First encounter for this student on this device = their NEWEST
        // transaction (we iterate newest→oldest). Initialize the entry with
        // that latest status. Guard with `!has()` prevents older rows from
        // overwriting it in subsequent iterations.
        if (!record.studentsMap.has(tx.studentId)) {
          record.studentsMap.set(tx.studentId, {
            matricNumber: tx.student.matricNumber,
            name: `${tx.student.lastName} ${tx.student.firstName}`,
            department: tx.student.department,
            lastStatus: tx.status,
            clearedCount: 0,
            blockedCount: 0,
          });
        }

        // Counters increment for EVERY transaction (the guard above only
        // protected lastStatus — counters must aggregate all rows).
        const st = record.studentsMap.get(tx.studentId);
        if (tx.status === 'CLEARED') st.clearedCount += 1;
        else if (tx.status === 'BLOCKED') st.blockedCount += 1;
      }
    }

    const devices = Array.from(deviceMap.values()).map(item => {
      const studentCount = item.studentsMap.size;
      const blockedCount = item.blockedCount;
      const clearedCount = item.clearedCount;

      // Flag devices where blocked attempts outnumber cleared attempts
      // (includes devices with 1 block and 0 clears).
      const hasMoreBlocksThanClears = blockedCount >= 1 && blockedCount > clearedCount;

      return {
        deviceId: item.deviceId,
        totalAttempts: item.totalAttempts,
        clearedCount,
        blockedCount,
        lastActive: item.lastActive,
        studentCount,
        isSuspicious: hasMoreBlocksThanClears,
        studentsList: Array.from(item.studentsMap.values())
      };
    });

    // Sort: flagged devices first, then by student count (descending).
    devices.sort((a, b) => {
      if (a.isSuspicious && !b.isSuspicious) return -1;
      if (!a.isSuspicious && b.isSuspicious) return 1;
      return b.studentCount - a.studentCount;
    });

    return NextResponse.json({ success: true, computers: devices }, { status: 200 });
  } catch (error: any) {
    console.error("[ADMIN VELOCITY ERROR]:", error.message);
    return NextResponse.json({ success: false, error: MSG.GENERIC_ERROR }, { status: 500 });
  }
}