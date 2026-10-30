// src/app/api/auth/register/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs'; // Uses bcryptjs, matching the login route and seed script
import { MSG } from '@/lib/messages';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { matricNumber, email, password, firstName, lastName, department, level, deviceId } = body;

    // 1. Required field validation
    if (!matricNumber || !email || !password || !firstName || !lastName || !department || !level) {
      return NextResponse.json({
        success: false,
        error: "All academic account fields are required."
      }, { status: 400 });
    }

    // 2. Normalize matric number and email
    const cleanMatric = matricNumber.trim().toUpperCase();
    const cleanEmail = email.trim().toLowerCase();

    // 3. Duplicate account check
    const existingStudent = await prisma.student.findFirst({
      where: {
        OR: [
          { matricNumber: cleanMatric },
          { email: cleanEmail }
        ]
      }
    });

    if (existingStudent) {
      const field = existingStudent.matricNumber === cleanMatric ? "Matriculation Number" : "Email Address";
      return NextResponse.json({
        success: false,
        error: `A student account with this ${field} already exists.`
      }, { status: 409 });
    }

    // 4. Create Student Account & Hash Password with BCRYPT (10 salt rounds)
    const hashedPassword = bcrypt.hashSync(password, 10);

    const newStudent = await prisma.student.create({
      data: {
        matricNumber: cleanMatric,
        email: cleanEmail,
        password: hashedPassword, // Hashed with bcrypt for login compatibility
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        department: department.trim(),
        level: Number(level),
        loginDeviceId: deviceId || "UNKNOWN_BASELINE"
      }
    });

    // 5. Return sanitized account (excluding password hash)
    const { password: _, ...sanitizedStudent } = newStudent;

    return NextResponse.json({
      success: true,
      message: "Undergraduate account registered successfully.",
      user: sanitizedStudent
    }, { status: 201 });

  } catch (error: any) {
    console.error("[STUDENT REGISTRATION ERROR]:", error.message);
    return NextResponse.json({
      success: false,
      error: MSG.GENERIC_ERROR
    }, { status: 500 });
  }
}