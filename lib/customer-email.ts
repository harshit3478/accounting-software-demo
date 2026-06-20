import type { PrismaClient } from "@prisma/client";

export const CUSTOMER_EMAIL_EXISTS_ERROR =
  "A customer with this email already exists";

type CustomerEmailClient = Pick<PrismaClient, "customer">;

export function normalizeCustomerEmail(
  email: string | null | undefined,
): string | null {
  const trimmed = typeof email === "string" ? email.trim() : "";
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}

export function isCustomerEmailUniqueViolation(error: unknown): boolean {
  const err = error as { code?: string; meta?: { target?: string[] | string } };
  if (err.code !== "P2002") return false;

  const target = err.meta?.target;
  if (Array.isArray(target)) {
    return target.includes("email") || target.includes("customers_email_key");
  }

  return String(target || "").includes("email");
}

export function customerEmailErrorResponse(error: unknown): {
  message: string;
  status: number;
} | null {
  if (
    error instanceof Error &&
    error.message === CUSTOMER_EMAIL_EXISTS_ERROR
  ) {
    return { message: CUSTOMER_EMAIL_EXISTS_ERROR, status: 409 };
  }

  if (isCustomerEmailUniqueViolation(error)) {
    return { message: CUSTOMER_EMAIL_EXISTS_ERROR, status: 409 };
  }

  return null;
}

export async function assertCustomerEmailAvailable(
  prismaClient: CustomerEmailClient,
  email: string | null | undefined,
  excludeCustomerId?: number,
): Promise<string | null> {
  const normalized = normalizeCustomerEmail(email);
  if (!normalized) return null;

  const existing = await prismaClient.customer.findFirst({
    where: {
      email: normalized,
      ...(excludeCustomerId !== undefined
        ? { id: { not: excludeCustomerId } }
        : {}),
    },
    select: { id: true },
  });

  if (existing) {
    throw new Error(CUSTOMER_EMAIL_EXISTS_ERROR);
  }

  return normalized;
}
