import QuickBooks from 'node-quickbooks';
import OAuthClient from 'intuit-oauth';
import prisma from './prisma';

export interface QuickBooksConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment: 'sandbox' | 'production';
}

export function getQuickBooksConfig(): QuickBooksConfig {
  return {
    clientId: process.env.QUICKBOOKS_CLIENT_ID || '',
    clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET || '',
    redirectUri: process.env.QUICKBOOKS_REDIRECT_URI || '',
    environment: (process.env.QUICKBOOKS_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox'
  };
}

export function getOAuthClient() {
  const config = getQuickBooksConfig();
  return new OAuthClient({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    environment: config.environment,
    redirectUri: config.redirectUri
  });
}

export function getQuickBooksAuthUri(): string {
  const oauthClient = getOAuthClient();
  return oauthClient.authorizeUri({
    scope: [
      OAuthClient.scopes.Accounting,
      OAuthClient.scopes.OpenId,
      OAuthClient.scopes.Profile,
      OAuthClient.scopes.Email
    ],
    state: generateStateToken()
  });
}

export function generateStateToken(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

}

export async function createQuickBooksClient(userId: number): Promise<QuickBooks | null> {
  const connection = await prisma.quickBooksConnection.findUnique({
    where: { userId }
  });

  if (!connection || !connection.isActive) {
    return null;
  }

  // Check if token is expired and refresh if needed
  if (new Date() >= connection.tokenExpiry) {
    await refreshQuickBooksToken(userId);
    return createQuickBooksClient(userId); // Recursive call with new token
  }

  const config = getQuickBooksConfig();
  
  return new QuickBooks(
    config.clientId,
    config.clientSecret,
    connection.accessToken,
    false, // No token secret needed for OAuth 2.0
    connection.realmId,
    config.environment === 'sandbox', // useSandbox
    true, // debug
    null, // minorversion
    '2.0', // oauthversion
    connection.refreshToken
  );
}

export async function refreshQuickBooksToken(userId: number): Promise<void> {
  const connection = await prisma.quickBooksConnection.findUnique({
    where: { userId }
  });

  if (!connection) {
    throw new Error('QuickBooks connection not found');
  }

  const config = getQuickBooksConfig();
  
  const qbo = new QuickBooks(
    config.clientId,
    config.clientSecret,
    connection.accessToken,
    false,
    connection.realmId,
    config.environment === 'sandbox',
    true,
    null,
    '2.0',
    connection.refreshToken
  );

  return new Promise((resolve, reject) => {
    qbo.refreshAccessToken((err: any, refreshResponse: any) => {
      if (err) {
        reject(err);
        return;
      }

      // Update tokens in database
      prisma.quickBooksConnection.update({
        where: { userId },
        data: {
          accessToken: refreshResponse.access_token,
          refreshToken: refreshResponse.refresh_token,
          tokenExpiry: new Date(Date.now() + refreshResponse.expires_in * 1000),
          updatedAt: new Date()
        }
      }).then(() => resolve()).catch(reject);
    });
  });
}

export function mapQuickBooksPaymentMethod(qbMethod: string): 'cash' | 'zelle' | 'quickbooks' | 'layaway' {
  const method = qbMethod.toLowerCase();
  
  // Map QuickBooks payment methods to our system
  if (method.includes('cash')) return 'cash';
  if (method.includes('zelle')) return 'zelle';
  if (method.includes('credit') || method.includes('debit') || method.includes('card')) return 'quickbooks';
  if (method.includes('check') || method.includes('bank')) return 'quickbooks';
  
  // Default to quickbooks for unknown methods
  return 'quickbooks';
}
