import { NextResponse } from "next/server";
import { clearAuthTokenCookie } from "@/lib/auth-config";

export async function POST() {
  const response = NextResponse.json({ success: true });
  clearAuthTokenCookie(response);
  return response;
}
