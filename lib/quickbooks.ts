import QuickBooks from "node-quickbooks";
import OAuthClient from "intuit-oauth";
import prisma from "./prisma";

export interface QuickBooksConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment: "sandbox" | "production";
}

export function getQuickBooksConfig(): QuickBooksConfig {
  return {
    clientId: process.env.QUICKBOOKS_CLIENT_ID || "",
    clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET || "",
    redirectUri: process.env.QUICKBOOKS_REDIRECT_URI || "",
    environment:
      (process.env.QUICKBOOKS_ENVIRONMENT as "sandbox" | "production") ||
      "sandbox",
  };
}

export function getOAuthClient() {
  const config = getQuickBooksConfig();
  return new OAuthClient({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    environment: config.environment,
    redirectUri: config.redirectUri,
  });
}

export function getQuickBooksAuthUri(): string {
  const oauthClient = getOAuthClient();
  return oauthClient.authorizeUri({
    scope: [
      OAuthClient.scopes.Accounting,
      OAuthClient.scopes.OpenId,
      OAuthClient.scopes.Profile,
      OAuthClient.scopes.Email,
    ],
    state: generateStateToken(),
  });
}

export function generateStateToken(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

export async function createQuickBooksClient(
  userId: number,
): Promise<QuickBooks | null> {
  const connection = await prisma.quickBooksConnection.findUnique({
    where: { userId },
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
    config.environment === "sandbox", // useSandbox
    true, // debug
    null, // minorversion
    "2.0", // oauthversion
    connection.refreshToken,
  );
}

export async function refreshQuickBooksToken(userId: number): Promise<void> {
  const connection = await prisma.quickBooksConnection.findUnique({
    where: { userId },
  });

  if (!connection) {
    throw new Error("QuickBooks connection not found");
  }

  const config = getQuickBooksConfig();

  const qbo = new QuickBooks(
    config.clientId,
    config.clientSecret,
    connection.accessToken,
    false,
    connection.realmId,
    config.environment === "sandbox",
    true,
    null,
    "2.0",
    connection.refreshToken,
  );

  return new Promise((resolve, reject) => {
    qbo.refreshAccessToken((err: any, refreshResponse: any) => {
      if (err) {
        reject(err);
        return;
      }

      // Calculate expiry date safely (default to 1 hour/3600s if missing)
      const expiresIn =
        typeof refreshResponse.expires_in === "number"
          ? refreshResponse.expires_in
          : 3600;

      // Update tokens in database
      prisma.quickBooksConnection
        .update({
          where: { userId },
          data: {
            accessToken: refreshResponse.access_token,
            refreshToken: refreshResponse.refresh_token,
            tokenExpiry: new Date(Date.now() + expiresIn * 1000),
            updatedAt: new Date(),
          },
        })
        .then(() => resolve())
        .catch(reject);
    });
  });
}

export function mapQuickBooksPaymentMethod(qbMethod: string): string {
  const method = qbMethod.toLowerCase();

  // Map QuickBooks payment methods to our system payment method names
  if (method.includes("cash")) return "Cash";
  if (method.includes("zelle")) return "Zelle";
  if (
    method.includes("credit") ||
    method.includes("debit") ||
    method.includes("card")
  )
    return "Card";
  if (method.includes("check") || method.includes("bank")) return "Check";

  // Default to Cash for unknown methods
  return "Cash";
}

/** Linked QB invoice TxnIds from a Payment (applied / payment-link). */
export function getLinkedInvoiceIdsFromPayment(qbPayment: any): string[] {
  const lines = Array.isArray(qbPayment?.Line)
    ? qbPayment.Line
    : qbPayment?.Line
      ? [qbPayment.Line]
      : [];

  const ids = new Set<string>();
  for (const line of lines) {
    const linked = Array.isArray(line?.LinkedTxn)
      ? line.LinkedTxn
      : line?.LinkedTxn
        ? [line.LinkedTxn]
        : [];
    for (const txn of linked) {
      if (
        txn?.TxnType === "Invoice" &&
        txn?.TxnId != null &&
        String(txn.TxnId).trim()
      ) {
        ids.add(String(txn.TxnId));
      }
    }
  }
  return Array.from(ids);
}

function fetchQuickBooksInvoice(qbo: any, invoiceId: string): Promise<any> {
  return new Promise((resolve, reject) => {
    qbo.getInvoice(invoiceId, (err: any, invoice: any) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(invoice);
    });
  });
}

function extractInvoiceMemo(invoice: any): string | null {
  const privateNote =
    typeof invoice?.PrivateNote === "string" ? invoice.PrivateNote.trim() : "";
  if (privateNote) return privateNote;

  const customerMemo =
    typeof invoice?.CustomerMemo?.value === "string"
      ? invoice.CustomerMemo.value.trim()
      : typeof invoice?.CustomerMemo === "string"
        ? invoice.CustomerMemo.trim()
        : "";
  return customerMemo || null;
}

/**
 * For QB payment-link / applied payments: read memo from the linked invoice(s).
 * Stored separately from Payment.notes.
 */
export async function fetchLinkedQuickBooksInvoiceMemo(
  qbo: any,
  qbPayment: any,
): Promise<string | null> {
  const invoiceIds = getLinkedInvoiceIdsFromPayment(qbPayment);
  if (!qbo || invoiceIds.length === 0) return null;

  const memos: string[] = [];
  for (const qbInvoiceId of invoiceIds) {
    try {
      const invoice = await fetchQuickBooksInvoice(qbo, qbInvoiceId);
      const memo = extractInvoiceMemo(invoice);
      if (memo && !memos.includes(memo)) {
        memos.push(memo);
      }
    } catch (error) {
      console.warn(
        `Failed to fetch linked QB invoice ${qbInvoiceId} for memo:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return memos.length > 0 ? memos.join(" | ") : null;
}
