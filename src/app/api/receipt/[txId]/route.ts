// src/app/api/receipt/[txId]/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MSG } from '@/lib/messages';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ txId: string }> }
) {
  try {
    const { txId } = await params;

    if (!txId) {
      return NextResponse.json({ success: false, error: "Transaction or Invoice reference is required." }, { status: 400 });
    }

    const invoice = await prisma.feeInvoice.findFirst({
      where: {
        OR: [
          { id: txId },
          { transactions: { some: { id: txId } } },
          { transactions: { some: { reference: txId } } },
        ],
      },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        student: {
          select: {
            matricNumber: true,
            firstName: true,
            lastName: true,
            department: true,
            level: true,
          }
        }
      },
    });

    if (!invoice) {
      return NextResponse.json({ success: false, error: "No matching invoice found." }, { status: 404 });
    }

    if (invoice.status !== 'PAID') {
      return NextResponse.json({ success: false, error: "Receipt cannot be generated for an invoice that is not PAID." }, { status: 403 });
    }

    return NextResponse.json({ success: true, invoice }, { status: 200 });
  } catch (error: any) {
    console.error("[RECEIPT API ERROR]:", error.message);
    return NextResponse.json({ success: false, error: MSG.GENERIC_ERROR }, { status: 500 });
  }
}