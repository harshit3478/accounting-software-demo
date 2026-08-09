import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";

// POST - Automatic permanent trash cleanup is disabled (soft-delete policy)
export async function POST(_request: NextRequest) {
  try {
    await requireSuperAdmin();

    return NextResponse.json({
      success: true,
      message:
        "Permanent trash cleanup is disabled. Soft-deleted documents are kept indefinitely.",
      deletedCount: 0,
      failedCount: 0,
    });
  } catch (error: any) {
    console.error("Error during cleanup:", error);

    if (error.message === "Super admin access required") {
      return NextResponse.json(
        { error: "Only superadmin can perform cleanup" },
        { status: 403 },
      );
    }

    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
