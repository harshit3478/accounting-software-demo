# QuickBooks Integration Setup Guide

## Overview
This accounting software now includes QuickBooks Online integration to automatically sync payments from QuickBooks to your application.

## Features
- ✅ OAuth 2.0 authentication with QuickBooks
- ✅ Automatic payment syncing (QuickBooks → App)
- ✅ Webhook support for real-time updates
- ✅ Token refresh handling
- ✅ Unmatched payments for manual invoice matching
- ✅ Settings page for connection management

## Setup Instructions

### 1. Create QuickBooks Developer Account

1. Go to https://developer.intuit.com/
2. Sign up for a developer account (free)
3. Create a new app in the Developer Dashboard

### 2. Configure Your QuickBooks App

1. In the QuickBooks Developer Dashboard:
   - Go to "Dashboard" → "My Apps"
   - Click your app name
   - Go to "Keys & OAuth"

2. Copy your credentials:
   - **Client ID**
   - **Client Secret**

3. Add Redirect URI:
   - Development: `http://localhost:3000/api/quickbooks/callback`
   - Production: `https://yourdomain.com/api/quickbooks/callback`

4. Enable Webhooks:
   - Go to "Webhooks" section
   - Add webhook URL:
     - Development: Use ngrok or similar (see below)
     - Production: `https://yourdomain.com/api/quickbooks/webhook`

### 3. Configure Environment Variables

Add these to your `.env` file:

```env
# QuickBooks OAuth Credentials
QUICKBOOKS_CLIENT_ID=your_client_id_here
QUICKBOOKS_CLIENT_SECRET=your_client_secret_here
QUICKBOOKS_REDIRECT_URI=http://localhost:3000/api/quickbooks/callback
QUICKBOOKS_ENVIRONMENT=sandbox

# QuickBooks Webhook Configuration
QUICKBOOKS_WEBHOOK_VERIFIER=your_webhook_verifier_token
QUICKBOOKS_WEBHOOK_URL=http://localhost:3000/api/quickbooks/webhook

# Optional: Public app URL for webhook display
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Get the Webhook Verifier Token:**
- In QuickBooks Developer Dashboard → Webhooks
- Copy the "Verifier Token"

### 4. Run Database Migration

```bash
npx prisma migrate dev --name add_quickbooks_integration
npx prisma generate
```

### 5. Local Development with Webhooks (Optional)

Since QuickBooks requires a public HTTPS URL for webhooks, use ngrok for local testing:

1. Install ngrok: https://ngrok.com/download
2. Start your Next.js app:
   ```bash
   npm run dev
   ```

3. In another terminal, start ngrok:
   ```bash
   ngrok http 3000
   ```

4. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

5. Update QuickBooks Developer Dashboard:
   - Webhook URL: `https://abc123.ngrok.io/api/quickbooks/webhook`
   - Redirect URI: Add `https://abc123.ngrok.io/api/quickbooks/callback`

6. Update your `.env`:
   ```env
   QUICKBOOKS_REDIRECT_URI=https://abc123.ngrok.io/api/quickbooks/callback
   ```

## Usage

### Connecting QuickBooks

1. Go to Settings page in the app (`/settings`)
2. Click "Connect to QuickBooks"
3. Login with your QuickBooks Online account
4. Authorize the connection
5. You'll be redirected back to Settings with success message

### How Payment Syncing Works

1. **Create Payment in QuickBooks:**
   - When you receive a payment in QuickBooks Online
   - QuickBooks sends a webhook notification to your app

2. **Automatic Payment Creation:**
   - App receives webhook
   - Creates unmatched payment entry with:
     - Amount from QuickBooks
     - Payment method (mapped to: cash/zelle/quickbooks/layaway)
     - Customer name in notes
     - Payment date

3. **Manual Matching:**
   - Go to Payments page
   - Click the search icon (Payment Matching)
   - Match the QuickBooks payment to your invoices
   - Payment shows as matched in both systems

### Disconnecting QuickBooks

1. Go to Settings page
2. Click "Disconnect"
3. Confirm the action
4. Payment syncing will stop

## API Endpoints

### OAuth Endpoints
- `GET /api/quickbooks/auth` - Get authorization URL
- `GET /api/quickbooks/callback` - OAuth callback handler

### Connection Management
- `GET /api/quickbooks/connection` - Get connection status
- `DELETE /api/quickbooks/connection` - Disconnect QuickBooks

### Webhook
- `POST /api/quickbooks/webhook` - Receive QuickBooks webhooks
- `GET /api/quickbooks/webhook` - Health check

## Database Schema

### QuickBooksConnection
Stores OAuth tokens and connection details for each user.

### QuickBooksWebhookLog
Logs all webhook events for debugging and audit trail.

## Payment Method Mapping

QuickBooks payment methods are mapped to our system as follows:

| QuickBooks Method | Our System |
|-------------------|------------|
| Cash              | cash       |
| Zelle             | zelle      |
| Credit Card       | quickbooks |
| Debit Card        | quickbooks |
| Check             | quickbooks |
| Bank Transfer     | quickbooks |
| Other             | quickbooks |

## Troubleshooting

### "Invalid signature" error
- Verify `QUICKBOOKS_WEBHOOK_VERIFIER` matches the token in Developer Dashboard
- Check webhook payload format

### "Connection not found" error
- User hasn't connected QuickBooks yet
- Connection was disconnected
- Go to Settings and reconnect

### Tokens expired
- App automatically refreshes tokens
- If refresh fails, user needs to reconnect
- Check Settings page for token status

### Webhooks not received
- Verify webhook URL is publicly accessible (HTTPS required)
- Check QuickBooks Developer Dashboard → Webhooks for delivery logs
- Ensure webhook URL is correctly configured

## Production Deployment

### Before deploying to production:

1. **Update Environment Variables:**
   ```env
   QUICKBOOKS_ENVIRONMENT=production
   QUICKBOOKS_REDIRECT_URI=https://yourdomain.com/api/quickbooks/callback
   QUICKBOOKS_WEBHOOK_URL=https://yourdomain.com/api/quickbooks/webhook
   NEXT_PUBLIC_APP_URL=https://yourdomain.com
   ```

2. **Update QuickBooks Developer Dashboard:**
   - Add production redirect URI
   - Add production webhook URL
   - Switch app to Production mode

3. **Test thoroughly:**
   - Test OAuth flow
   - Test webhook delivery
   - Test payment creation
   - Test payment matching

## Security Notes

- ✅ Webhook signature verification implemented
- ✅ OAuth tokens stored encrypted in database
- ✅ Automatic token refresh
- ✅ User-level connection isolation
- ⚠️ Keep `QUICKBOOKS_CLIENT_SECRET` secure
- ⚠️ Keep `QUICKBOOKS_WEBHOOK_VERIFIER` secure
- ⚠️ Use HTTPS in production

## Support

For QuickBooks API documentation:
- https://developer.intuit.com/app/developer/qbo/docs/get-started

For OAuth 2.0 details:
- https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0

For Webhook documentation:
- https://developer.intuit.com/app/developer/qbo/docs/develop/webhooks
