# Module: whatsapp-crm

> **🔗 Live API:** https://all-live-project-api-center-rupesh-klr.holistichealervedika.com/api/whatsapp-crm/v1/info (public)

> Node.js · Express · WhatsApp Business API · Webhooks · Workflow Engine

Automated WhatsApp CRM Engine — inbound webhook handling, contact lifecycle management, outbound message dispatch, and no-code automation workflows. Built for high-concurrency webhook ingestion with contact deduplication and conversation threading.

**Portfolio story:** Production-grade CRM architecture. Webhook events are verified, deduplicated, and dispatched to the correct contact thread. Workflows trigger automated responses on keyword match, opt-in, or schedule. Outbound messages respect WhatsApp's 24-hour conversation window policy.

---

## Endpoints

Base path: `/api/whatsapp-crm/v1/`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET`  | `/info` | Public | Module metadata |
| `GET`  | `/webhook` | Public | WhatsApp webhook verify challenge (GET verify) |
| `POST` | `/webhook` | Public | Receive inbound WhatsApp events |
| `GET`  | `/contacts` | Bearer | List CRM contacts |
| `GET`  | `/contacts/:id` | Bearer | Get contact details + conversation history |
| `POST` | `/messages/send` | admin / manager | Send a WhatsApp message |
| `GET`  | `/workflows` | Bearer | List automation workflows |
| `POST` | `/workflows` | admin | Create a workflow |
| `PATCH`| `/workflows/:id` | admin / manager | Toggle workflow active/paused |

---

## Webhook verification (GET)

WhatsApp sends a GET request to verify ownership before delivering events:

```http
GET /api/whatsapp-crm/v1/webhook
  ?hub.mode=subscribe
  &hub.verify_token=YOUR_VERIFY_TOKEN
  &hub.challenge=CHALLENGE_STRING
```

The endpoint responds with the raw `hub.challenge` value if `hub.verify_token` matches `WHATSAPP_VERIFY_TOKEN` in `.env`. WhatsApp confirms the webhook is yours.

---

## Webhook event (POST)

WhatsApp sends event payloads to `POST /webhook`. This endpoint is **public** (no Bearer) — Meta signs requests with `X-Hub-Signature-256`. The handler verifies the HMAC signature before processing.

Supported event types:

| Event type | What triggers it |
|---|---|
| `messages` | Inbound text, media, reaction, or location from a contact |
| `statuses` | Delivery / read receipts for outbound messages |
| `referrals` | Contact clicked a Click-to-WhatsApp ad |

Example inbound message payload (received from Meta):

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "WABA_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": { "phone_number_id": "PHONE_NUMBER_ID" },
        "messages": [{
          "id":        "wamid.inbound123",
          "from":      "919876543210",
          "type":      "text",
          "timestamp": "1718352000",
          "text":      { "body": "Hello, I need support" }
        }]
      }
    }]
  }]
}
```

The handler: verifies HMAC → upserts contact by phone → stores message → runs workflow trigger check → responds `200 OK` within 5 seconds (Meta requires this).

---

## GET `/contacts`

```http
GET /api/whatsapp-crm/v1/contacts?page=1&limit=20
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
```

```json
{
  "success": true,
  "data": {
    "contacts": [
      {
        "id":          "C001",
        "name":        "Rahul Verma",
        "phone":       "+919876543210",
        "status":      "active",
        "unread":      2,
        "lastMessage": "Hello, I need support",
        "lastSeen":    "2026-06-14T08:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "totalPages": 1
  }
}
```

`status` values: `active` | `unread` | `opted-out`

---

## POST `/messages/send`

```http
POST /api/whatsapp-crm/v1/messages/send
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
Content-Type: application/json

{
  "to":   "+919876543210",
  "type": "text",
  "text": "Your appointment is confirmed for June 15th."
}
```

For template messages (outside the 24-hour window):

```json
{
  "to":   "+919876543210",
  "type": "template",
  "template": {
    "name":     "appointment_reminder",
    "language": { "code": "en_US" },
    "components": [{
      "type": "body",
      "parameters": [{ "type": "text", "text": "June 15th" }]
    }]
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": { "messageId": "wamid.outbound456", "status": "sent" }
}
```

---

## GET `/workflows`

```http
GET /api/whatsapp-crm/v1/workflows
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
```

```json
{
  "success": true,
  "data": {
    "workflows": [
      {
        "id":      "WF001",
        "name":    "New Lead Welcome",
        "trigger": { "type": "keyword", "value": "hello" },
        "action":  { "type": "send_template", "template": "welcome_msg" },
        "active":  true,
        "runs":    142
      }
    ]
  }
}
```

**Trigger types:** `keyword` | `opt_in` | `schedule` | `first_message`
**Action types:** `send_template` | `send_text` | `tag_contact` | `assign_agent`

---

## Environment variables for this module

```env
WHATSAPP_VERIFY_TOKEN=your_webhook_verify_token
WHATSAPP_ACCESS_TOKEN=EAAxxxxxxx...     # Meta Business API access token
WHATSAPP_PHONE_NUMBER_ID=1234567890     # Registered WhatsApp Business phone ID
WHATSAPP_APP_SECRET=your_app_secret     # Used to verify X-Hub-Signature-256
```

---

## Error responses

| Scenario | Status | message |
|---|---|---|
| Invalid HMAC signature | 403 | `Invalid webhook signature` |
| Wrong verify token | 403 | `Verification failed` |
| Contact not found | 404 | `Contact not found` |
| Outside 24h window (no template) | 422 | `Message window expired — use a template` |
| Meta API error | 502 | `WhatsApp API error: <meta message>` |

---

## Default users

| username | role | Access |
|---|---|---|
| `crm_admin` | admin | All endpoints — contacts, send, workflows |
| `agent` | manager | View contacts, send messages — no workflow create |
| `support` | viewer | View contacts and workflow list — no send |

---

## Files

| File | What it does |
|---|---|
| `app.js` | Router + `meta` export. `meta.active = false` to disable. |
| `crm.routes.js` | Route definitions — public webhook + protected contact/message/workflow routes |
| `crm.controller.js` | Webhook HMAC verify, contact upsert, message dispatch, workflow CRUD |
| `crm.service.js` | WhatsApp Business API client (axios), contact DB ops, workflow engine |
