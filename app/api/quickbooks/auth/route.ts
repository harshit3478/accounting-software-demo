import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/auth';
import { getQuickBooksAuthUri } from '../../../../lib/quickbooks';

export async function GET() {
  try {
    await requireAuth();
    
    // Generate authorization URL
    const authUri = getQuickBooksAuthUri();
    console.log('Generated Auth URI:', authUri);
    
    return NextResponse.json({ authUri });
  } catch (error: any) {
    console.error('QuickBooks auth init error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
