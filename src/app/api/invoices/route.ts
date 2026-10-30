// src/app/api/invoices/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { FeeCategory, InvoiceStatus } from '@prisma/client';
import { MSG } from '@/lib/messages';

// Fee schedule enforced server-side — client cannot set the amount
const FEE_SCHEDULE: Record<FeeCategory, number> = {
  TUITION: 85500.00,
  ACCEPTANCE: 45000.00,
  ICT_INFRASTRUCTURE: 15000.00,
  LIBRARY: 5000.00,
  EXAM_CLEARANCE: 10000.00,
};

// GET: Fetch invoices for a student, or a single invoice by id
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get('studentId');
    const invoiceId = searchParams.get('invoiceId');

    if (invoiceId) {
      // Pre-flight guardrail: include transactions + auditLog + appeal so the
      // checkout page can detect BLOCKED transactions and approved appeals
      // before rendering the payment form.
      const invoice = await prisma.feeInvoice.findUnique({
        where: { id: invoiceId },
        include: {
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              auditLog: true,
              appeal: true,
            },
          },
        },
      });
      return NextResponse.json({ success: true, invoice });
    }
    if (!studentId) {
      return NextResponse.json({ success: false, error: "Student UUID is required." }, { status: 400 });
    }

    const invoices = await prisma.feeInvoice.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          // Attach appeal status so the student UI can evaluate it
          include: {
            appeal: true,
          },
        }
      }
    });

    return NextResponse.json({ success: true, invoices }, { status: 200 });
  } catch (error: any) {
    console.error("[FETCH INVOICES ERROR]:", error.message);
    return NextResponse.json({ success: false, error: MSG.GENERIC_ERROR }, { status: 500 });
  }
}

// POST: Create an invoice, checking existing invoice state first
export async function POST(req: Request) {
  try {
    const { studentId, category, session } = await req.json();

    if (!studentId || !category || !session) {
      return NextResponse.json({ success: false, error: "Student ID, Fee Category, and Session are required." }, { status: 400 });
    }

    if (!(category in FEE_SCHEDULE)) {
      return NextResponse.json({ success: false, error: "Invalid fee category selected." }, { status: 400 });
    }

    const amount = FEE_SCHEDULE[category as FeeCategory];

    // Check whether an invoice already exists for this student/category/session
    const existingInvoice = await prisma.feeInvoice.findFirst({
      where: {
        studentId,
        category: category as FeeCategory,
        session,
        status: {
          in: [InvoiceStatus.PAID, InvoiceStatus.PENDING, InvoiceStatus.BLOCKED]
        }
      },
    });

    if (existingInvoice) {
      if (existingInvoice.status === InvoiceStatus.PAID) {
        return NextResponse.json({
          success: false,
          error: "This invoice is already PAID for the selected academic session.",
          isCleared: true,
        }, { status: 400 });
      }

      if (existingInvoice.status === InvoiceStatus.BLOCKED) {
        return NextResponse.json({
          success: false,
          error: "This invoice is BLOCKED. Submit an appeal before creating a new transaction.",
          isBlocked: true,
        }, { status: 403 });
      }

      if (existingInvoice.status === InvoiceStatus.PENDING) {
        return NextResponse.json({
          success: true,
          message: "Existing pending invoice retrieved.",
          invoice: existingInvoice,
          isExisting: true,
        }, { status: 200 });
      }
    }

    // Create new invoice only if no existing invoice matches this student/category/session
    const newInvoice = await prisma.feeInvoice.create({
      data: {
        studentId,
        category: category as FeeCategory,
        amount,
        session,
        status: InvoiceStatus.PENDING,
      },
    });

    return NextResponse.json({
      success: true,
      message: "New invoice generated successfully.",
      invoice: newInvoice,
      isExisting: false,
    }, { status: 201 });
  } catch (error: any) {
    console.error("[CREATE INVOICE ERROR]:", error.message);
    return NextResponse.json({ success: false, error: MSG.GENERIC_ERROR }, { status: 500 });
  }
}