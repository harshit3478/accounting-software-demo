import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/auth';
import { getOAuthClient } from '../../../../lib/quickbooks';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    
    const code = searchParams.get('code');
    const realmId = searchParams.get('realmId');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        new URL(`/settings?qb_error=${encodeURIComponent(error)}`, request.url)
      );
    }

    if (!code || !realmId) {
      return NextResponse.redirect(
        new URL('/settings?qb_error=missing_parameters', request.url)
      );
    }

    const oauthClient = getOAuthClient();

    // Exchange authorization code for tokens
    // intuit-oauth expects the full URL to extract params
    const authResponse = await oauthClient.createToken(request.url);
    const tokenResponse = authResponse.getJson();

    // Calculate token expiry
    const tokenExpiry = new Date(Date.now() + tokenResponse.expires_in * 1000);

    // Store or update connection in database
    await prisma.quickBooksConnection.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        realmId,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        tokenExpiry,
        isActive: true
      },
      update: {
        realmId,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        tokenExpiry,
        isActive: true,
        updatedAt: new Date()
      }
    });

    // Redirect to settings page with success message
    return NextResponse.redirect(
      new URL('/settings?qb_success=true', request.url)
    );
  } catch (error: any) {
    console.error('QuickBooks callback error:', error);
    return NextResponse.redirect(
      new URL(`/settings?qb_error=${encodeURIComponent(error.message)}`, request.url)
    );
  }
}
