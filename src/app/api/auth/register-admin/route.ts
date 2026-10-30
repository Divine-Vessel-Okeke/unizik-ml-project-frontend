// src/app/api/auth/register-admin/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { MSG } from '@/lib/messages';
import { isAdminRole } from '@/lib/roles';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { fullName, username, role, password } = body;

    // 1. Required field validation
    if (!fullName || !username || !role || !password) {
      return NextResponse.json({
        success: false,
        error: "All fields are required."
      }, { status: 400 });
    }

    // 2. Password length check
    if (password.length < 8) {
      return NextResponse.json({
        success: false,
        error: "Passwords must be at least 8 characters long."
      }, { status: 400 });
    }

    // 3. Normalize username and full name
    const cleanUsername = username.trim().toLowerCase();
    const cleanFullName = fullName.trim();
    const cleanRole = role.trim().toUpperCase();

    // 4. Role validation
    if (!isAdminRole(cleanRole)) {
      return NextResponse.json({
        success: false,
        error: "Invalid admin role."
      }, { status: 400 });
    }

    // 5. Duplicate username check
    const existingAdmin = await prisma.admin.findUnique({
      where: { username: cleanUsername }
    });

    if (existingAdmin) {
      return NextResponse.json({
        success: false,
        error: "An admin account with this username already exists."
      }, { status: 409 });
    }

    // 6. Hash Password with BCRYPT (10 salt rounds)
    const hashedPassword = bcrypt.hashSync(password, 10);

    // 7. Create admin Record
    const newAdmin = await prisma.admin.create({
      data: {
        username: cleanUsername,
        password: hashedPassword,
        fullName: cleanFullName,
        role: cleanRole
      }
    });

    // 8. Return sanitized account (excluding password hash)
    const { password: _, ...sanitizedAdmin } = newAdmin;

    return NextResponse.json({
      success: true,
      message: "Admin account created successfully.",
      user: sanitizedAdmin
    }, { status: 201 });

  } catch (error: any) {
    console.error("[ADMIN REGISTRATION ERROR]:", error.message);
    return NextResponse.json({
      success: false,
      error: MSG.GENERIC_ERROR
    }, { status: 500 });
  }
}