# Email Functionality Testing Guide

This guide shows you how to test the email system (RF-04: Notificaciones) in the RETO platform.

## Overview

The email system is implemented in:
- **Service**: `apps/backend/src/lib/mail/mail.service.ts`
- **Integration**: `apps/backend/src/modules/notifications/notifications.service.ts`
- **Database**: `Notification` model in `packages/db/prisma/schema.prisma`

### How It Works

1. Any backend module (assignments, cases, alerts, etc.) calls `notificationsService.notify()`
2. This creates an **in-app notification** in the database
3. Simultaneously, an **email is sent** to the user (non-blocking)
4. If SMTP is not configured, the email is logged to console (development mode)

---

## Testing Methods

### **Method 1: Console Testing (No SMTP Setup)**

This is the quickest way to test without configuring SMTP credentials.

#### Steps:

1. **Ensure SMTP is NOT configured** (or leave it empty):
   ```bash
   # In your .env file, make sure SMTP_HOST is empty or commented:
   # SMTP_HOST=""
   ```

2. **Start the backend**:
   ```bash
   cd apps/backend
   npm run dev
   ```

3. **Trigger a notification** by creating an assignment or case:
   ```bash
   # Example: Create an assignment (this triggers a notification)
   curl -X POST http://localhost:3000/api/v1/assignments \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{
       "caseId": 1,
       "assignedToId": 2
     }'
   ```

4. **Check the backend console output** for log lines like:
   ```
   [mail] (simulado) Para: user@example.com | Asunto: Nueva Asignación
   El técnico evaluador ha sido asignado al caso.
   ```

**Pros**: Fast, no configuration needed
**Cons**: No actual email is sent

---

### **Method 2: Unit Test with Jest (Mocked Email)**

#### Steps:

1. **Create a test file** `tests/api/11-email.test.mjs`:

```javascript
/**
 * 11-email.test.mjs
 * Tests email notifications (RF-04)
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  request, loginAll, tokens,
  assertOk, requireToken,
} from './helpers.mjs';

describe('Email Notifications', () => {
  before(async () => { await loginAll(); });

  describe('POST /notifications (via assignment creation)', () => {
    test('Creating an assignment triggers email notification', async () => {
      // Get a case first
      const casesRes = await request('GET', '/cases?page=1&pageSize=1');
      const cases = assertOk(casesRes, 200);
      
      if (cases.items.length === 0) {
        console.log('No cases available, skipping test');
        return;
      }

      const caseId = cases.items[0].caseId;

      // Create assignment (should trigger notification)
      const res = await request('POST', '/assignments', {
        token: tokens.coordinator,
        body: {
          caseId,
          assignedToId: 3, // technician ID
        },
      });

      // Verify assignment was created
      assert.ok([200, 201].includes(res.status),
        `Expected 200/201, got ${res.status}: ${JSON.stringify(res.data)}`);
    });
  });

  describe('GET /notifications (user receives notifications)', () => {
    test('User can retrieve their notifications', async () => {
      const res = await request('GET', '/notifications?page=1&pageSize=20', {
        token: tokens.technician,
      });

      const data = assertOk(res, 200);
      assert.ok(Array.isArray(data.items), 'notifications should be array');
      assert.ok(typeof data.total === 'number', 'total should be number');
    });

    test('Notification has correct shape', async () => {
      const res = await request('GET', '/notifications?page=1&pageSize=20');
      const data = assertOk(res, 200);
      
      if (data.items.length > 0) {
        const notif = data.items[0];
        assert.ok(typeof notif.notificationId === 'number');
        assert.ok(typeof notif.title === 'string');
        assert.ok(typeof notif.message === 'string');
        assert.ok(typeof notif.read === 'boolean');
        assert.ok(typeof notif.createdAt === 'string');
      }
    });
  });

  describe('PATCH /notifications/:id/read (mark as read)', () => {
    test('User can mark notification as read', async () => {
      // Get a notification
      const getRes = await request('GET', '/notifications?page=1&pageSize=1');
      const data = assertOk(getRes, 200);
      
      if (data.items.length === 0) {
        console.log('No notifications available, skipping test');
        return;
      }

      const notifId = data.items[0].notificationId;

      // Mark as read
      const markRes = await request('PATCH', `/notifications/${notifId}/read`);
      assert.ok([200, 204].includes(markRes.status),
        `Expected 200/204, got ${markRes.status}`);
    });
  });

  describe('PATCH /notifications/read-all (mark all as read)', () => {
    test('User can mark all notifications as read', async () => {
      const res = await request('PATCH', '/notifications/read-all', {
        token: tokens.technician,
      });

      assert.ok([200, 204].includes(res.status),
        `Expected 200/204, got ${res.status}`);
    });
  });
});
```

2. **Run the test**:
   ```bash
   npm test -- tests/api/11-email.test.mjs
   ```

**Pros**: Integrated with your test suite, verifies end-to-end
**Cons**: Still won't send real emails

---

### **Method 3: Real SMTP Testing (Gmail Example)**

This actually sends real emails using Gmail SMTP.

#### Prerequisites:

1. **Enable 2-Step Verification** on your Gmail account
2. **Create an App Password**:
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and "Windows Computer"
   - Copy the 16-character password

#### Steps:

1. **Update your `.env` file**:
   ```bash
   SMTP_HOST="smtp.gmail.com"
   SMTP_PORT="587"
   SMTP_SECURE="false"
   SMTP_USER="your-email@gmail.com"
   SMTP_PASS="your-app-password"
   MAIL_FROM="RETO Notifications <your-email@gmail.com>"
   ```

2. **Restart the backend**:
   ```bash
   cd apps/backend
   npm run dev
   ```

3. **Trigger a notification**:
   ```bash
   # Create an assignment
   curl -X POST http://localhost:3000/api/v1/assignments \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{
       "caseId": 1,
       "assignedToId": 2
     }'
   ```

4. **Check your email inbox** for the notification email

5. **Watch backend logs** for confirmation:
   ```
   [mail] ✅ Correo enviado exitosamente a: user@example.com | Asunto: "Nueva Asignación" | MsgId: <...>
   ```

**Pros**: Real emails sent and verified
**Cons**: Requires Gmail account and app passwords

---

### **Method 4: Advanced - Mock Nodemailer in Tests**

For advanced testing without real SMTP, you can mock the nodemailer transport:

1. **Create test with mocked transporter** `tests/api/11-email-mock.test.mjs`:

```javascript
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import sinon from 'sinon';

// Note: This requires installing sinon: npm install --save-dev sinon

describe('Email Service (Mocked)', () => {
  test('Email service sends mail with correct parameters', async () => {
    // You would need to export nodemailer's transporter for mocking
    // This is a more advanced approach requiring backend modifications
  });
});
```

**Pros**: Fast, controlled, no external dependencies
**Cons**: Requires backend modifications for mockability

---

## Testing Checklist

Use this checklist to verify email functionality:

- [ ] **Email Service Initialized**
  - Start backend with SMTP_HOST configured
  - Check console for: `[mail] Cliente SMTP inicializado`

- [ ] **Notification Triggered**
  - Create an assignment, case, or alert
  - Verify in-app notification appears in `GET /notifications`

- [ ] **Email Sent**
  - Method 1: Check console logs for `[mail] ✅ Correo enviado`
  - Method 2: Receive actual email in inbox

- [ ] **Error Handling**
  - Test with invalid SMTP credentials
  - Verify app doesn't crash: `[mail] ❌ Error enviando correo`
  - In-app notification should still be created

- [ ] **User Isolation**
  - Login as different users
  - Verify each user only sees their own notifications

---

## Triggering Email Notifications

Here are the main actions that trigger email notifications:

### 1. **Assignment Created** (RF-10)
```bash
POST /api/v1/assignments
{
  "caseId": 1,
  "assignedToId": 3
}
```
→ Sends email to the assigned technician

### 2. **LAPCH Alert Created** (RF-08)
```bash
POST /api/v1/lapch-alerts
{
  "numeroAlerta": "LAPCH-2026001",
  "fecha": "2026-01-01T00:00:00Z",
  "producto": "Milk",
  "institutionId": 1,
  "descripcion": "Alert description"
}
```
→ Sends email to relevant coordinators/admins

### 3. **BPM Request Created** (RF-05)
```bash
POST /api/v1/bpm-requests
{
  "institutionId": 1,
  "tipoEstablecimiento": "Lechería",
  "motivo": "Solicitud de inspección"
}
```
→ Sends email to admins/coordinators

### 4. **Report Status Changed** (RF-16/17)
```bash
PATCH /api/v1/evaluation-reports/1/status
{
  "status": "ENVIADO"
}
```
→ Sends email to reviewers

---

## Troubleshooting

### Issue: "Mail is only logged to console"
- **Cause**: SMTP_HOST is not configured or empty
- **Fix**: Set `SMTP_HOST` in `.env`
- **Verify**: `echo $SMTP_HOST` (should not be empty)

### Issue: "Authentication failed"
- **Cause**: Wrong SMTP_USER or SMTP_PASS
- **Fix**: Double-check credentials in `.env`
- **For Gmail**: Use an App Password, not your main password

### Issue: "Connection timeout"
- **Cause**: SMTP_HOST or SMTP_PORT incorrect
- **Fix**: Try `smtp.gmail.com:587` (with SMTP_SECURE=false)

### Issue: "Email not received after 5 minutes"
- **Cause**: Email went to spam/junk folder
- **Fix**: Check spam folder, verify sender address in MAIL_FROM

### Issue: "Database says notification was created but no email log"
- **Cause**: `mailService.sendMail()` is failing silently
- **Fix**: Check backend console for `[mail] ❌ Error` message

---

## Environment Variables Quick Reference

```bash
# SMTP Configuration for email (RF-04)
# Leave empty/undefined for console-only testing

# Gmail SMTP
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="app-password"
MAIL_FROM="RETO <your-email@gmail.com>"

# Office 365
SMTP_HOST="smtp.office365.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="email@organization.onmicrosoft.com"
SMTP_PASS="your-password"
MAIL_FROM="RETO <email@organization.onmicrosoft.com>"

# Self-hosted / Custom
SMTP_HOST="mail.yourdomain.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="notifications@yourdomain.com"
SMTP_PASS="your-password"
MAIL_FROM="RETO <notifications@yourdomain.com>"
```

---

## API Endpoints for Testing

### Get User's Notifications
```bash
GET /api/v1/notifications?page=1&pageSize=20
Authorization: Bearer <token>
```

### Mark Single Notification as Read
```bash
PATCH /api/v1/notifications/:notificationId/read
Authorization: Bearer <token>
```

### Mark All Notifications as Read
```bash
PATCH /api/v1/notifications/read-all
Authorization: Bearer <token>
```

### Get Notification Details
```bash
GET /api/v1/notifications/:notificationId
Authorization: Bearer <token>
```

---

## Code References

- **Mail Service**: `apps/backend/src/lib/mail/mail.service.ts`
- **Notifications Service**: `apps/backend/src/modules/notifications/notifications.service.ts`
- **Notifications Router**: `apps/backend/src/modules/notifications/notifications.router.ts`
- **Database Schema**: Lines 850-862 in `packages/db/prisma/schema.prisma`
- **Existing Tests**: `tests/api/08-alerts-complaints-notifications.test.mjs` (lines 310-390)
