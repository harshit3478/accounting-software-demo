# QuickBooks Integration - Quick Reference

## 🚀 Quick Start (5 Minutes)

### 1. Get Webhook Verifier Token
```
1. Go to: https://developer.intuit.com/
2. Your App → Webhooks → Generate Verifier Token
3. Copy token → Add to .env as QUICKBOOKS_WEBHOOK_VERIFIER
```

### 2. Start Testing
```bash
# Terminal 1
npm run dev

# Terminal 2 (for webhooks)
ngrok http 3000
# Copy HTTPS URL → QuickBooks Webhook URL
```

### 3. Connect & Sync
```
1. Open: http://localhost:3000/settings
2. Click: "Connect to QuickBooks"
3. Authorize in QuickBooks
4. Click: "Sync Now" ✅
```

---

## 📍 Key URLs

| What | URL |
|------|-----|
| QuickBooks Dev Dashboard | https://developer.intuit.com/ |
| QB Sandbox | https://sandbox.qbo.intuit.com/ |
| Settings Page | http://localhost:3000/settings |
| Webhook Endpoint | /api/quickbooks/webhook |
| Manual Sync | /api/quickbooks/sync |
| Prisma Studio | `npm run prisma studio` |

---

## 🔑 Environment Variables

```bash
# Required (get from QB Dashboard)
QUICKBOOKS_CLIENT_ID=...
QUICKBOOKS_CLIENT_SECRET=...
QUICKBOOKS_WEBHOOK_VERIFIER=...  # ← Generate in Webhooks section

# Auto-configured
QUICKBOOKS_REDIRECT_URI=http://localhost:3000/api/quickbooks/callback
QUICKBOOKS_ENVIRONMENT=sandbox
QUICKBOOKS_WEBHOOK_URL=https://your-ngrok.ngrok.io/api/quickbooks/webhook
```

---

## ✅ Quick Test

```bash
# 1. Test webhook endpoint
curl http://localhost:3000/api/quickbooks/webhook
# Should return: {"status":"ok",...}

# 2. Connect QB in UI
open http://localhost:3000/settings

# 3. Create test payment in QB Sandbox
# - Go to Sales → Receive Payment
# - Amount: $100, Method: Cash
# - Save

# 4. Check logs - payment should auto-sync via webhook
# OR click "Sync Now" button

# 5. Verify in database
npm run prisma studio
# → Payment table → Check for new entry with quickbooksId
```

---

## 🛠️ Common Commands

```bash
# Start app
npm run dev

# Start ngrok
ngrok http 3000

# View database
npm run prisma studio

# Check git status
git status

# View logs
# (Watch terminal where app is running)

# Test webhook
curl http://localhost:3000/api/quickbooks/webhook
```

---

## 📊 Expected Results

### After Connecting QB:
- ✅ Settings shows "Connected to QuickBooks"
- ✅ Company ID displayed
- ✅ "Sync Now" button visible
- ✅ Database has QuickBooksConnection record

### After Creating Payment in QB:
- ✅ Webhook POST received (check ngrok logs)
- ✅ App logs show "Created payment X from QB payment Y"
- ✅ Database has Payment with quickbooksId
- ✅ QuickBooksWebhookLog has entry

### After Clicking "Sync Now":
- ✅ Button shows "Syncing..." with spinner
- ✅ Toast shows "X created, Y updated, Z skipped"
- ✅ Last Sync timestamp updates
- ✅ No duplicate payments in database

---

## 🐛 Quick Fixes

**Webhook not working?**
```bash
# Check verifier token is set
echo $QUICKBOOKS_WEBHOOK_VERIFIER

# Test endpoint
curl https://your-ngrok-url/api/quickbooks/webhook

# Check QB dashboard webhook is "Active"
```

**Payments not syncing?**
```bash
# 1. Check connection
# Settings → Should show "Active"

# 2. Manual sync
# Click "Sync Now" button

# 3. Check logs
# Look for errors in terminal
```

**Token expired?**
```bash
# Tokens auto-refresh
# If fails, click "Reconnect" in Settings
```

**Duplicates created?**
```bash
# Shouldn't happen!
# Check database for duplicate quickbooksId
# Review webhook logs in database
```

---

## 📁 Important Files

```
app/api/quickbooks/
  ├── webhook/route.ts    ← Receives QB webhooks
  ├── sync/route.ts       ← Manual sync endpoint
  ├── auth/route.ts       ← OAuth start
  ├── callback/route.ts   ← OAuth callback
  └── connection/route.ts ← Status/disconnect

app/settings/page.tsx     ← UI with Sync button

lib/quickbooks.ts         ← QB client, token refresh

prisma/schema.prisma      ← Database models

QUICKBOOKS_SETUP.md       ← Detailed setup guide
QUICKBOOKS_TESTING.md     ← Testing checklist
QUICKBOOKS_IMPLEMENTATION.md ← Technical details
```

---

## 🎯 Success Criteria

Integration is working when:
- [x] Can connect QuickBooks via Settings
- [x] Webhook receives QB payment events
- [x] Manual "Sync Now" fetches payments
- [x] No duplicate payments created
- [x] Payments appear automatically in database
- [x] Error handling works gracefully

---

## 📞 Next Steps

1. **Test locally** with ngrok
2. **Review logs** for any errors
3. **Verify no duplicates** in database
4. **Deploy to staging** with production QB app
5. **Monitor for 24 hours** before production
6. **Deploy to production** 🚀

---

## 📚 Documentation

- **Setup**: `QUICKBOOKS_SETUP.md`
- **Testing**: `QUICKBOOKS_TESTING.md`
- **Implementation**: `QUICKBOOKS_IMPLEMENTATION.md`
- **QB API Docs**: https://developer.intuit.com/

---

**Need Help?** Check the detailed guides above or QuickBooks developer docs.

**Ready to Deploy?** Follow the production checklist in `QUICKBOOKS_TESTING.md`.

---

✨ **You're all set!** Start with `QUICKBOOKS_SETUP.md` for detailed instructions.
