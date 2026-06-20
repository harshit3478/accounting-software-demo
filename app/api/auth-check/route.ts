import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken, isSuperAdmin } from "@/lib/auth";
import { buildPermissionsPayload } from "@/lib/permissions";
import { formatUserDisplayName } from "@/lib/user-display";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("token")?.value;

  if (!token) {
    return NextResponse.json({
      authenticated: false,
      message: "No token found",
    });
  }

  try {
    const dbUser = await getUserFromToken();
    if (!dbUser) {
      return NextResponse.json(
        { authenticated: false, message: "Invalid token" },
        { status: 401 },
      );
    }

    const { permissions } = buildPermissionsPayload(dbUser);

    const user = {
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
      name: dbUser.name,
      avatarUrl: dbUser.avatarUrl,
      displayName: formatUserDisplayName(dbUser),
      canUploadDocuments: permissions.documents.upload,
      canRenameDocuments: permissions.documents.rename,
      canDeleteDocuments: permissions.documents.delete,
      canUploadCheques: permissions.chequeVault.upload,
      canApproveCheques: permissions.chequeVault.approve,
      settingsPermissions: permissions.settings,
      isSuperAdmin: isSuperAdmin(dbUser),
    };

    return NextResponse.json({
      authenticated: true,
      user,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        authenticated: false,
        error: error.message,
      },
      { status: 401 },
    );
  }
}
