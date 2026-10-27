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

    const computers = Array.from(deviceMap.values()).map(item => {
      const studentCount = item.studentsMap.size;
      const blockedCount = item.blockedCount;
      const clearedCount = item.clearedCount;

      // A device is "suspicious" if blocked attempts outnumber cleared attempts.
      // Single-attempt devices (0 cleared, 1 blocked) are also suspicious — the
      // previous "blockedCount >= 2" threshold silently hid fresh fraud attempts
      // and mislabeled them as "Personal Computer ✓".
      const isSuspicious = blockedCount >= 1 && blockedCount > clearedCount;

      return {
        deviceId: item.deviceId,
        totalAttempts: item.totalAttempts,
        clearedCount,
        blockedCount,
        lastActive: item.lastActive,
        studentCount,
        isSuspicious,
        studentsList: Array.from(item.studentsMap.values())
      };
    });

    // Sort: suspicious devices FIRST (surface fraud signals), then by student count.
    // Previously sorted only by studentCount, which buried red-flagged devices
    // below normal cybercafes — directly contradicting the Bursar Guide banner.
    computers.sort((a, b) => {
      if (a.isSuspicious && !b.isSuspicious) return -1;
      if (!a.isSuspicious && b.isSuspicious) return 1;
      return b.studentCount - a.studentCount;
    });

    return NextResponse.json({ success: true, computers }, { status: 200 });
  } catch (error: any) {
    console.error("[FETCH COMPUTERS ERROR]:", error.message);
    return NextResponse.json({ success: false, error: "Failed to load computer tracking data." }, { status: 500 });
  }
}