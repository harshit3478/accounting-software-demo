import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/auth';
import { getQuickBooksAuthUri, getQuickBooksConfig } from '../../../../lib/quickbooks';

export async function GET() {
  try {
    await requireAuth();
    
    // Log configuration for debugging
    const config = getQuickBooksConfig();
    console.log('QuickBooks Auth Init:', { 
      environment: config.environment, 
      clientIdPrefix: config.clientId.substring(0, 5) + '...',
      redirectUri: config.redirectUri 
    });

    // Generate authorization URL
    const authUri = getQuickBooksAuthUri();
    
    return NextResponse.json({ authUri });
  } catch (error: any) {
    console.error('QuickBooks auth init error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
