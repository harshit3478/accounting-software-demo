# QuickBooks Integration Testing Guide

## Test Environment Setup

### 1. Install ngrok (for local webhook testing)
```bash
# macOS
brew install ngrok

# Or download from https://ngrok.com/download
```

### 2. Set up QuickBooks Sandbox
1. Go to https://developer.intuit.com/
2. Create a QuickBooks Sandbox test company
3. This gives you a test environment with fake data

### 3. Configure Environment Variables

Update your `.env` file with your QuickBooks credentials:

```bash
# From QuickBooks Developer Dashboard
QUICKBOOKS_CLIENT_ID=your_actual_client_id
QUICKBOOKS_CLIENT_SECRET=your_actual_client_secret
QUICKBOOKS_REDIRECT_URI=http://localhost:3000/api/quickbooks/callback
QUICKBOOKS_ENVIRONMENT=sandbox

# From QuickBooks Webhooks section (CRITICAL!)
QUICKBOOKS_WEBHOOK_VERIFIER=your_actual_verifier_token
QUICKBOOKS_WEBHOOK_URL=https://your-ngrok-url.ngrok.io/api/quickbooks/webhook
```

## Testing Steps

### Test 1: OAuth Connection ✅

**Purpose**: Verify QuickBooks OAuth connection works

```bash
# 1. Start the app
npm run dev

# 2. Open browser
open http://localhost:3000/settings
```

**Steps**:
1. Click "Connect to QuickBooks" button
2. You'll be redirected to QuickBooks login
3. Sign in with your sandbox account
4. Authorize the connection
5. You should be redirected back with success message
6. Connection status should show "Connected to QuickBooks"

**Expected Result**:
- ✅ Connection status shows "Active"
- ✅ Company ID displayed
- ✅ "Sync Now" and "Disconnect" buttons appear
- ✅ No errors in console

**Check Database**:
```bash
# In a new terminal
npm run prisma studio

# Navigate to QuickBooksConnection table
# Should see one record with your userId, realmId, and tokens
```

---

### Test 2: Webhook Setup ✅

**Purpose**: Set up webhook endpoint for automatic payment sync

```bash
# 1. Start ngrok in a new terminal
ngrok http 3000

# You'll see output like:
# Forwarding: https://abc123.ngrok.io -> http://localhost:3000
```

**Steps**:
1. Copy the HTTPS URL from ngrok (e.g., `https://abc123.ngrok.io`)
2. Update `.env`:
   ```bash
   QUICKBOOKS_WEBHOOK_URL=https://abc123.ngrok.io/api/quickbooks/webhook
   ```
3. Restart your app (Ctrl+C, then `npm run dev`)
4. Go to QuickBooks Developer Dashboard → Your App → Webhooks
5. Set webhook URL: `https://abc123.ngrok.io/api/quickbooks/webhook`
6. Subscribe to **Payment** events (Create, Update)
7. Test the webhook using QuickBooks "Test" button

**Expected Result**:
- ✅ Webhook test returns 200 OK
- ✅ QuickBooks shows webhook is "Active"
- ✅ Check your terminal logs for webhook health check

**Test Webhook Endpoint**:
```bash
# In a new terminal
curl https://your-ngrok-url.ngrok.io/api/quickbooks/webhook

# Expected response:
# {
#   "status": "ok",
#   "message": "QuickBooks webhook endpoint is active",
#   "verifierConfigured": true,
#   "environment": "sandbox"
# }
```

---

### Test 3: Manual Sync ✅

**Purpose**: Test manual payment sync from QuickBooks

**Prerequisites**: Have at least one payment in your QuickBooks Sandbox

**Create Test Payment in QuickBooks Sandbox**:
1. Go to your QuickBooks Sandbox: https://sandbox.qbo.intuit.com/
2. Sign in with your sandbox account
3. Go to **Sales** → **Customers**
4. Create a test customer (if needed)
5. Create an invoice for that customer
6. Go to **Sales** → **Invoices** → Click on your invoice
7. Click **Receive Payment**
8. Fill in payment details:
   - Amount: $100.00
   - Payment date: Today
   - Payment method: Cash or Credit Card
9. Click **Save and close**

**Test Manual Sync**:
```bash
# 1. Go to Settings page
open http://localhost:3000/settings

# 2. Click "Sync Now" button
```

**Expected Result**:
- ✅ Button shows "Syncing..." with spinning icon
- ✅ Success toast appears: "Sync completed: X created, Y updated, Z skipped"
- ✅ Last Sync timestamp updates
- ✅ Check console logs for sync details

**Verify in Database**:
```bash
# Open Prisma Studio
npm run prisma studio

# Navigate to Payment table
# Should see new payment with:
# - quickbooksId: set
# - quickbooksSyncedAt: current timestamp
# - method: 'quickbooks' or 'cash' (depending on QB payment type)
# - isMatched: false
# - invoiceId: null
```

**Test Idempotency** (No Duplicates):
```bash
# Click "Sync Now" again

# Expected:
# - Same payment should be "updated" not "created"
# - No duplicate entries in database
# - Toast shows: "0 created, 1 updated, 0 skipped"
```

---

### Test 4: Webhook Automatic Sync ✅

**Purpose**: Test automatic payment creation via webhook

**Prerequisites**:
- ngrok running
- Webhook configured in QuickBooks
- App connected to QuickBooks

**Steps**:
1. Keep ngrok terminal open and visible
2. Keep app terminal open and visible
3. Create a NEW payment in QuickBooks Sandbox (follow steps from Test 3)
4. **Watch your terminals**:
   - ngrok terminal will show incoming POST request
   - app terminal will show webhook processing logs

**Expected Result in App Terminal**:
```
Webhook processing event: Payment.Create
Fetching payment from QuickBooks API: PMT-123
Created payment 42 from QuickBooks payment PMT-123
```

**Expected Result in ngrok Terminal**:
```
POST /api/quickbooks/webhook    200 OK
```

**Verify in Database**:
```bash
# Refresh Prisma Studio
# New payment should appear automatically
# - Created within seconds of QB payment
# - All fields populated
# - quickbooksId matches QB payment ID
```

**Check Webhook Logs**:
```bash
# In Prisma Studio → QuickBooksWebhookLog table
# Should see log entry:
# - eventType: "Payment.Create"
# - processed: true
# - createdPaymentId: matches Payment.id
# - errorMessage: null
```

---

### Test 5: Duplicate Prevention ✅

**Purpose**: Verify duplicates are not created

**Method 1 - Create payment then sync**:
```bash
# 1. Create payment in QuickBooks
# 2. Wait for webhook to create it (watch logs)
# 3. Click "Sync Now" button

# Expected:
# - Toast shows: "0 created, 1 updated, 0 skipped"
# - No duplicate in database
# - quickbooksSyncedAt updated
```

**Method 2 - Simulate duplicate webhook**:
```bash
# Manually trigger webhook twice (if you have the payload)
# Or create payment, delete from DB, let webhook fire again

# Expected:
# - Second webhook is treated as success
# - No error thrown
# - Webhook log shows "Payment already exists"
```

---

### Test 6: Error Handling ✅

**Purpose**: Verify error handling and logging

**Test Invalid Signature**:
```bash
curl -X POST https://your-ngrok-url.ngrok.io/api/quickbooks/webhook \
  -H "Content-Type: application/json" \
  -H "intuit-signature: invalid_signature" \
  -d '{"test": "data"}'

# Expected: 401 Unauthorized
# Response: {"error": "Invalid signature"}
```

**Test Disconnected QuickBooks**:
```bash
# 1. Go to Settings → Click "Disconnect"
# 2. Try to click "Sync Now"

# Expected:
# - Error toast: "QuickBooks not connected or inactive"
# - Graceful error handling
```

**Test Expired Token**:
```bash
# Tokens auto-refresh, but you can test by:
# 1. In database, set tokenExpiry to past date
# 2. Click "Sync Now"

# Expected:
# - Token refreshes automatically
# - Sync continues successfully
# - If refresh fails, shows "Reconnect" button
```

---

### Test 7: UI/UX Testing ✅

**Test Connection UI**:
- [ ] "Connect to QuickBooks" button works
- [ ] Loading states show properly ("Connecting...")
- [ ] Success/error toasts appear
- [ ] Connection status displays correctly
- [ ] Company ID shows in UI
- [ ] Last Sync timestamp updates
- [ ] Token expiry warning appears when expired

**Test Sync Button**:
- [ ] "Sync Now" button works
- [ ] Spinning icon appears while syncing
- [ ] Button disabled during sync
- [ ] Success toast shows counts (created/updated/skipped)
- [ ] Error toast shows clear error messages

**Test Disconnect**:
- [ ] "Disconnect" button shows confirmation modal
- [ ] Modal explains consequences
- [ ] Disconnect works properly
- [ ] UI updates to show disconnected state

---

## Production Testing Checklist

Before deploying to production:

### Pre-Deployment
- [ ] Set `QUICKBOOKS_ENVIRONMENT=production` in production env
- [ ] Update `QUICKBOOKS_REDIRECT_URI` to production URL
- [ ] Update `QUICKBOOKS_WEBHOOK_URL` to production HTTPS URL
- [ ] Verify `QUICKBOOKS_WEBHOOK_VERIFIER` is set correctly
- [ ] Test OAuth flow in staging environment
- [ ] Test webhook endpoint is accessible from public internet
- [ ] Review all environment variables are set

### Post-Deployment
- [ ] Connect production QuickBooks account
- [ ] Create test payment in production QB → verify webhook works
- [ ] Test manual sync
- [ ] Monitor logs for errors
- [ ] Check webhook delivery in QB dashboard
- [ ] Verify no duplicate payments created
- [ ] Test disconnect and reconnect flow

### Monitoring
- [ ] Set up logging/monitoring for webhook failures
- [ ] Monitor `QuickBooksWebhookLog` table for errors
- [ ] Check `lastSyncAt` timestamp regularly
- [ ] Alert on failed webhook deliveries
- [ ] Monitor payment sync accuracy

---

## Common Issues & Solutions

### Issue: Webhook not receiving events
**Solution**:
1. Check ngrok is running and URL is correct
2. Verify webhook URL in QB dashboard matches ngrok URL
3. Check `QUICKBOOKS_WEBHOOK_VERIFIER` is correct
4. Look for errors in app logs
5. Test webhook endpoint with curl

### Issue: "Invalid signature" error
**Solution**:
1. Verify `QUICKBOOKS_WEBHOOK_VERIFIER` matches QB dashboard token
2. Re-generate verifier token in QB dashboard if needed
3. Restart app after changing env variables

### Issue: Payments not syncing
**Solution**:
1. Check QuickBooks connection status in Settings
2. Verify token hasn't expired
3. Click "Sync Now" to manually trigger
4. Check app logs for errors
5. Verify payment exists in QB within sync window (30 days)

### Issue: Duplicate payments
**Solution**:
1. Should not happen - `quickbooksId` is unique
2. Check database for duplicate `quickbooksId` values
3. Review webhook logs for errors
4. If found, delete duplicates and investigate logs

### Issue: Token expired
**Solution**:
1. Tokens auto-refresh every hour
2. If auto-refresh fails, click "Reconnect"
3. Check refresh token is valid in database
4. May need to re-authorize connection

---

## Debug Commands

```bash
# Check webhook endpoint
curl http://localhost:3000/api/quickbooks/webhook

# Check connection status
# (requires auth - use browser)
open http://localhost:3000/settings

# View database
npm run prisma studio

# Check logs
tail -f /path/to/app/logs

# Test QuickBooks API connection
# (in your app, add a test endpoint to call QB API)
```

---

## Success Criteria

Your QuickBooks integration is working correctly when:

✅ **Connection**: Can connect/disconnect via Settings UI  
✅ **OAuth**: Authorization flow completes successfully  
✅ **Webhooks**: Payments auto-sync when created in QuickBooks  
✅ **Manual Sync**: "Sync Now" button fetches recent payments  
✅ **Idempotency**: No duplicate payments created  
✅ **Error Handling**: Graceful errors with helpful messages  
✅ **Logging**: All events logged to `QuickBooksWebhookLog`  
✅ **UI/UX**: Clean, responsive UI with proper loading states  
✅ **Security**: Webhook signatures verified, tokens secure  

---

## Next Steps After Testing

1. **Deploy to staging** with production QuickBooks app
2. **Test end-to-end** in staging environment
3. **Monitor webhook deliveries** for 24-48 hours
4. **Deploy to production**
5. **Set up monitoring/alerts** for failures
6. **Document any production-specific quirks**

Need help? Check `QUICKBOOKS_SETUP.md` for detailed setup instructions.
