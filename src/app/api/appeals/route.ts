// src/app/api/appeals/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MSG } from '@/lib/messages';

// GET: List appeals, optionally filtered by studentId
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get('studentId');

    const whereClause: any = {};
    if (studentId) whereClause.studentId = studentId;

    const appeals = await prisma.appeal.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        student: { select: { matricNumber: true, firstName: true, lastName: true, department: true } },
        transaction: {
          include: {
            invoice: { select: { category: true, session: true, amount: true, id: true } },
            auditLog: true
          }
        }
      }
    });

    return NextResponse.json({ success: true, appeals }, { status: 200 });
  } catch (error: any) {
    console.error('[APPEALS GET ERROR]:', error.message);
    return NextResponse.json({ success: false, error: MSG.GENERIC_ERROR }, { status: 500 });
  }
}

// POST: Submit or resubmit an appeal for a blocked transaction
export async function POST(req: Request) {
  try {
    const { studentId, invoiceId, reason } = await req.json();

    if (!studentId || !invoiceId || !reason) {
      return NextResponse.json({ success: false, error: "Missing required fields." }, { status: 400 });
    }

    // 1. Find the latest blocked transaction for this invoice
    const tx = await prisma.transaction.findFirst({
      where: { invoiceId, studentId, status: 'BLOCKED' },
      orderBy: { createdAt: 'desc' }
    });

    if (!tx) {
      return NextResponse.json({ success: false, error: "No blocked transaction found for this invoice." }, { status: 404 });
    }

    // 2. Query whether an appeal already exists for this transaction
    const existingAppeal = await prisma.appeal.findUnique({
      where: { transactionId: tx.id }
    });

    if (existingAppeal) {
      if (existingAppeal.status === 'PENDING') {
        return NextResponse.json({
          success: false,
          error: "An appeal for this blocked transaction is already pending."
        }, { status: 400 });
      }

      if (existingAppeal.status === 'APPROVED') {
        return NextResponse.json({
          success: false,
          error: "This appeal was already approved."
        }, { status: 400 });
      }

      // Only REJECTED reaches this branch
      const resubmittedAppeal = await prisma.appeal.update({
        where: { transactionId: tx.id },
        data: {
          reason,
          status: 'PENDING',
          adminNotes: null
        }
      });

      return NextResponse.json({ success: true, appeal: resubmittedAppeal, message: "Appeal resubmitted successfully." }, { status: 200 });
    }

    // 3. Create fresh appeal if no prior record exists
    const appeal = await prisma.appeal.create({
      data: {
        transactionId: tx.id,
        studentId,
        reason,
        status: 'PENDING'
      }
    });

    return NextResponse.json({ success: true, appeal }, { status: 201 });
  } catch (error: any) {
    console.error("[APPEAL SUBMISSION ERROR]:", error.message);
    return NextResponse.json({ success: false, error: MSG.GENERIC_ERROR }, { status: 500 });
  }
}

// PATCH: Admin approves or rejects an appeal
export async function PATCH(req: Request) {
  try {
    const { appealId, status, adminNotes } = await req.json();

    const appeal = await prisma.appeal.findUnique({
      where: { id: appealId },
      include: { transaction: true }
    });

    if (!appeal) {
      return NextResponse.json({ success: false, error: "Appeal not found." }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Update appeal status and admin notes
      await tx.appeal.update({
        where: { id: appealId },
        data: { status, adminNotes }
      });

      // 2. If approved, set the parent invoice back to PENDING
      if (status === 'APPROVED' && appeal.transaction?.invoiceId) {
        await tx.feeInvoice.update({
          where: { id: appeal.transaction.invoiceId },
          data: { status: 'PENDING' as any }
        });
      }
    });

    return NextResponse.json({ success: true, message: `Appeal ${status.toLowerCase()}.` }, { status: 200 });
  } catch (error: any) {
    console.error('[APPEALS PATCH ERROR]:', error.message);
    return NextResponse.json({ success: false, error: MSG.GENERIC_ERROR }, { status: 500 });
  }
}