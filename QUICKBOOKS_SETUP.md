# QuickBooks Integration Setup Guide

This guide walks you through setting up the QuickBooks integration for automatic payment syncing.

## Prerequisites

1. A QuickBooks Online account (Sandbox or Production)
2. A QuickBooks Developer account at https://developer.intuit.com/

## Step 1: Create QuickBooks App

1. Go to https://developer.intuit.com/
2. Sign in and navigate to **My Apps**
3. Click **Create an App** → Select **QuickBooks Online and Payments**
4. Fill in your app details:
   - **App Name**: Your Accounting Software
   - **Description**: Automated payment syncing
   - **Company URL**: Your domain

## Step 2: Get OAuth Credentials

1. In your app dashboard, go to **Keys & OAuth**
2. Copy your credentials:
   - **Client ID** → `QUICKBOOKS_CLIENT_ID`
   - **Client Secret** → `QUICKBOOKS_CLIENT_SECRET`
3. Set **Redirect URIs**:
   - Development: `http://localhost:3000/api/quickbooks/callback`
   - Production: `https://yourdomain.com/api/quickbooks/callback`

## Step 3: Configure Webhooks

1. In your app dashboard, go to **Webhooks**
2. Click **Create Webhook**
3. **Generate a Verifier Token** - this is critical for security
   - Copy this token → `QUICKBOOKS_WEBHOOK_VERIFIER` in your `.env`
4. Set your **Webhook URL**:
   - Development: Use [ngrok](https://ngrok.com/) to expose localhost
     ```bash
     ngrok http 3000
     # Use the HTTPS URL: https://abc123.ngrok.io/api/quickbooks/webhook
     ```
   - Production: `https://yourdomain.com/api/quickbooks/webhook`
5. Subscribe to **Payment** events:
   - ✅ Payment.Create
   - ✅ Payment.Update
   - ✅ Payment.Delete (optional)

## Step 4: Environment Variables

Add these to your `.env` file:

```env
# QuickBooks OAuth Credentials
QUICKBOOKS_CLIENT_ID=your_client_id_here
QUICKBOOKS_CLIENT_SECRET=your_client_secret_here
QUICKBOOKS_REDIRECT_URI=http://localhost:3000/api/quickbooks/callback
QUICKBOOKS_ENVIRONMENT=sandbox  # or "production"

# QuickBooks Webhook Configuration
QUICKBOOKS_WEBHOOK_VERIFIER=your_verifier_token_from_step_3
QUICKBOOKS_WEBHOOK_URL=http://localhost:3000/api/quickbooks/webhook
```

## Step 5: Connect QuickBooks in App

1. Start your app: `npm run dev`
2. Go to **Settings** page in your app
3. Click **Connect to QuickBooks**
4. Authorize the connection with your QuickBooks account
5. You'll be redirected back with a success message

## Step 6: Test the Integration

### Test Webhook (Development)

1. Start ngrok: `ngrok http 3000`
2. Update webhook URL in QuickBooks dashboard with ngrok URL
3. Create a test payment in QuickBooks Sandbox
4. Check your app - the payment should appear automatically

### Test Manual Sync

1. Go to **Settings** page in your app
2. Click **Sync Now** button
3. This will fetch the last 30 days of payments from QuickBooks

## How It Works

### Automatic Sync (Webhooks)
- When a payment is created/updated in QuickBooks, a webhook is sent to your app
- The app verifies the webhook signature for security
- Payment details are fetched from QuickBooks API
- Payment is created in your database (duplicates are automatically detected and skipped)
- All webhook events are logged for debugging

### Manual Sync
- Click "Sync Now" button to fetch payments on demand
- Syncs last 30 days by default
- Idempotent: won't create duplicates
- Updates `lastSyncAt` timestamp

### Duplicate Prevention
- Uses `quickbooksId` unique constraint in database
- Checks for existing payments before creating
- Handles race conditions gracefully
- Logs all webhook events for audit trail

## Troubleshooting

### Webhook Not Receiving Events

1. **Check webhook URL is accessible**:
   ```bash
   curl https://your-webhook-url/api/quickbooks/webhook
   # Should return: {"status":"ok","message":"QuickBooks webhook endpoint is active"}
   ```

2. **Verify signature**: Make sure `QUICKBOOKS_WEBHOOK_VERIFIER` matches the token in QuickBooks dashboard

3. **Check logs**: Look for errors in your app console

### Token Expired Error

- Tokens expire after 1 hour
- The app automatically refreshes tokens
- If refresh fails, click "Reconnect" in Settings

### Payments Not Appearing

1. Check QuickBooks connection status in Settings
2. Click "Sync Now" to manually fetch recent payments
3. Check if payments have been created in the last 30 days (default sync window)
4. Check app logs for errors

## Production Deployment

### Important: HTTPS Required

QuickBooks webhooks **require HTTPS** in production. HTTP URLs will be rejected.

### Deployment Checklist

- [ ] Set `QUICKBOOKS_ENVIRONMENT=production` in production `.env`
- [ ] Update OAuth redirect URI to production domain
- [ ] Update webhook URL to production HTTPS endpoint
- [ ] Verify webhook endpoint is accessible: `curl https://yourdomain.com/api/quickbooks/webhook`
- [ ] Test webhook with QuickBooks webhook tester
- [ ] Test end-to-end: Create payment in QuickBooks → Check it appears in app
- [ ] Monitor webhook logs regularly

### Security Best Practices

1. **Never commit** `.env` file to git
2. **Rotate credentials** periodically
3. **Monitor webhook logs** for suspicious activity
4. **Use strong verifier tokens** (QuickBooks generates these securely)
5. **Keep tokens secure** in production environment variables

## API Endpoints

- `POST /api/quickbooks/webhook` - Receives webhook events from QuickBooks
- `GET /api/quickbooks/webhook` - Health check / status
- `GET /api/quickbooks/auth` - Get OAuth authorization URL
- `GET /api/quickbooks/callback` - OAuth callback handler
- `GET /api/quickbooks/connection` - Get connection status
- `DELETE /api/quickbooks/connection` - Disconnect QuickBooks
- `POST /api/quickbooks/sync` - Manual sync (last 30 days)
- `GET /api/quickbooks/sync` - Get sync status

## Support

- QuickBooks API Docs: https://developer.intuit.com/app/developer/qbo/docs/get-started
- Webhook Docs: https://developer.intuit.com/app/developer/qbo/docs/develop/webhooks
- OAuth 2.0 Guide: https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0
