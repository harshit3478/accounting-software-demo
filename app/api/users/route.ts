import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import prisma from "../../../lib/prisma";
import { isSuperAdmin, requireSettingPermission } from "../../../lib/auth";
import {
  defaultPrivilegesForRole,
  sanitizePrivilegesForRole,
} from "../../../lib/permissions";
import cache, { CACHE_KEYS, CACHE_TTL } from "../../../lib/cache";
import { invalidateUsers } from "../../../lib/cache-helpers";
import {
  formatSensitiveActionOtpError,
  requireSensitiveActionOtp,
} from "../../../lib/sensitive-action-otp";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function filterVisibleUsers(
  users: Array<{ id: number; email: string; role: string }>,
  currentUser: { id: number; email: string; role: string },
) {
  return users.filter((user) => {
    if (isSuperAdmin(user)) return false;
    if (user.id === currentUser.id) return false;
    if (user.role === "admin" && !isSuperAdmin(currentUser)) return false;
    return true;
  });
}

function buildManageableUsersWhere(
  currentUser: { id: number; email: string; role: string },
  filters: { email?: string; role?: string },
) {
  const superAdminId = parseInt(process.env.SUPERADMIN_ID || "1");
  const superAdminEmail = process.env.SUPERADMIN_EMAIL;
  const superAdminMatch: Array<{ email: string } | { id: number }> = [
    { id: superAdminId },
  ];
  if (superAdminEmail) {
    superAdminMatch.push({ email: superAdminEmail });
  }

  const AND: Record<string, unknown>[] = [
    { NOT: { id: currentUser.id } },
    { NOT: { OR: superAdminMatch } },
  ];

  if (!isSuperAdmin(currentUser)) {
    AND.push({ role: { not: "admin" } });
  }

  if (filters.email) {
    AND.push({ email: { contains: filters.email } });
  }

  if (filters.role) {
    AND.push({ role: filters.role });
  }

  return { AND };
}

const userListSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  privileges: true,
  createdAt: true,
} as const;

function formatUserWriteError(error: unknown): {
  message: string;
  status: number;
} {
  const err = error as { code?: string; message?: string };
  if (err.code === "P2002") {
    return {
      message: "A user with this email already exists",
      status: 409,
    };
  }
  if (err.message === "Unauthorized") {
    return { message: "Unauthorized", status: 401 };
  }
  if (err.message === "Forbidden") {
    return { message: "Admin access required", status: 403 };
  }
  const otpError = formatSensitiveActionOtpError(error);
  if (otpError) {
    return otpError;
  }
  return {
    message: err.message || "Request failed",
    status: 500,
  };
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireSettingPermission("users");
    const { searchParams } = new URL(request.url);
    const pageParam = searchParams.get("page");

    if (pageParam === null) {
      const cacheKey = CACHE_KEYS.ALL_USERS;
      const cached = cache.get(cacheKey);
      if (cached && Array.isArray(cached)) {
        return NextResponse.json(filterVisibleUsers(cached, currentUser));
      }

      const users = await prisma.user.findMany({
        select: userListSelect,
      });

      const manageableUsers = users.filter((user) => !isSuperAdmin(user));
      cache.set(cacheKey, manageableUsers, CACHE_TTL.LONG);

      return NextResponse.json(filterVisibleUsers(manageableUsers, currentUser));
    }

    const page = Math.max(1, parseInt(pageParam || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "10", 10)),
    );
    const email = normalizeEmail(searchParams.get("email") || "");
    const role = searchParams.get("role")?.trim() || "";

    const where = buildManageableUsersWhere(currentUser, {
      email: email || undefined,
      role: role || undefined,
    });

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: userListSelect,
      }),
    ]);

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireSettingPermission("users");
    const { email, password, name, role, privileges, otp } =
      await request.json();

    await requireSensitiveActionOtp(currentUser, otp);

    if (!email?.trim() || !name?.trim()) {
      return NextResponse.json(
        { error: "Email and name are required" },
        { status: 400 },
      );
    }

    const normalizedEmail = normalizeEmail(email);

    // Only superadmin can create admins
    if (role === "admin" && !isSuperAdmin(currentUser)) {
      return NextResponse.json(
        { error: "Only superadmin can create admins" },
        { status: 403 },
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 },
      );
    }

    // Generate random placeholder password if none provided (login is OTP-based)
    const passwordToHash =
      password || require("crypto").randomBytes(32).toString("hex");
    const hashedPassword = await bcrypt.hash(passwordToHash, 10);
    const defaultPrivileges = defaultPrivilegesForRole(role);
    const resolvedPrivileges = sanitizePrivilegesForRole(
      role,
      privileges || defaultPrivileges,
    );

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash: hashedPassword,
        name: name.trim(),
        role,
        privileges: resolvedPrivileges,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        privileges: true,
        createdAt: true,
      },
    });

    // Invalidate user list cache
    invalidateUsers();

    return NextResponse.json(user, { status: 201 });
  } catch (error: unknown) {
    const { message, status } = formatUserWriteError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const currentUser = await requireSettingPermission("users");
    const { id, email, name, role, privileges, password, otp } =
      await request.json();

    await requireSensitiveActionOtp(currentUser, otp);

    if (!id) {
      return NextResponse.json(
        { error: "User id is required" },
        { status: 400 },
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, email: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (isSuperAdmin(targetUser)) {
      return NextResponse.json(
        {
          error:
            "Super admin profile cannot be edited here. Use Settings → My Profile.",
        },
        { status: 403 },
      );
    }

    if (targetUser.id === currentUser.id) {
      return NextResponse.json(
        {
          error:
            "You cannot edit your own account here. Use Settings → My Profile.",
        },
        { status: 403 },
      );
    }

    // Only superadmin can edit admins or assign admin role
    if (
      (targetUser.role === "admin" || role === "admin") &&
      !isSuperAdmin(currentUser)
    ) {
      return NextResponse.json(
        { error: "Only superadmin can edit admins" },
        { status: 403 },
      );
    }

    if (!email?.trim() || !name?.trim()) {
      return NextResponse.json(
        { error: "Email and name are required" },
        { status: 400 },
      );
    }

    const normalizedEmail = normalizeEmail(email);
    const emailTaken = await prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        NOT: { id },
      },
      select: { id: true },
    });
    if (emailTaken) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 },
      );
    }

    const updateData: {
      email: string;
      name: string;
      role: string;
      privileges?: unknown;
      passwordHash?: string;
    } = {
      email: normalizedEmail,
      name: name.trim(),
      role,
    };
    if (privileges) {
      updateData.privileges = sanitizePrivilegesForRole(role, privileges);
    }

    // Hash and update password if provided
    if (password && password.trim()) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        privileges: true,
        createdAt: true,
      },
    });

    // Invalidate user list cache
    invalidateUsers();

    return NextResponse.json(user);
  } catch (error: unknown) {
    const { message, status } = formatUserWriteError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await requireSettingPermission("users");
    const { id, otp } = await request.json();

    await requireSensitiveActionOtp(currentUser, otp);

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (isSuperAdmin(targetUser)) {
      return NextResponse.json(
        { error: "Cannot delete super admin" },
        { status: 403 },
      );
    }

    if (targetUser.id === currentUser.id) {
      return NextResponse.json(
        { error: "You cannot delete your own account" },
        { status: 403 },
      );
    }

    await prisma.user.delete({ where: { id } });

    // Invalidate user list cache
    invalidateUsers();

    return NextResponse.json({ message: "User deleted" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
