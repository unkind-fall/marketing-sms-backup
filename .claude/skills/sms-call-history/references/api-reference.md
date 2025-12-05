# SMS & Call History API Reference

Base URL: `https://marketing-sms-backup.marketing-409.workers.dev`

## Authentication

All endpoints (except `/health`) require the `X-API-Key` header.

## Endpoints

### Health Check
```
GET /health
```
No authentication required.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-26T12:34:56.789Z"
}
```

---

### List Phones
```
GET /phones
```
List all phone numbers with message and call statistics.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | int | 100 | Max results (1-500) |
| offset | int | 0 | Pagination offset |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "phone": "+61400000000",
      "display_name": "John Doe",
      "message_count": 145,
      "last_message_at": 1700000000000,
      "call_count": 23,
      "last_call_at": 1699999999000,
      "updated_at": 1700000000000
    }
  ],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "count": 12
  }
}
```

---

### Get Messages
```
GET /messages
```
Get SMS/MMS messages for a specific phone number. Supports filtering by subscription/SIM and including calls.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| phone | string | Yes | Phone number to filter by |
| limit | int | No | Max results (default: 100, max: 500) |
| offset | int | No | Pagination offset (default: 0) |
| subscription | string | No | Filter by subscription/SIM ID |
| include | string | No | Set to `calls` to include call history |

**Response (messages only):**
```json
{
  "success": true,
  "phone": "+61400000000",
  "subscription_id": null,
  "data": [
    {
      "id": "abc123def456",
      "phone": "+61400000000",
      "phone_raw": "0400000000",
      "type": "sms",
      "direction": "received",
      "body": "Hello, this is a message",
      "timestamp": 1700000000000,
      "readable_date": "Nov 15, 2024 2:30:45 PM",
      "contact_name": "John Doe",
      "subscription_id": "1",
      "sim_slot": null,
      "created_at": 1700000000000
    }
  ],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "count": 145
  }
}
```

**Response (with include=calls):**
```json
{
  "success": true,
  "phone": "+61400000000",
  "subscription_id": "1",
  "data": {
    "messages": [...],
    "calls": [...]
  },
  "pagination": {
    "limit": 100,
    "offset": 0,
    "messageCount": 50,
    "callCount": 30,
    "totalCount": 80
  }
}
```

**Direction Values:**
- `received` - Incoming message
- `sent` - Outgoing message

**Type Values:**
- `sms` - Text message
- `mms` - Multimedia message

---

### Get Single Message
```
GET /messages/:id
```
Get a specific message by ID.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "abc123def456",
    "phone": "+61400000000",
    "phone_raw": "0400000000",
    "type": "sms",
    "direction": "received",
    "body": "Hello, this is a message",
    "timestamp": 1700000000000,
    "readable_date": "Nov 15, 2024 2:30:45 PM",
    "contact_name": "John Doe",
    "created_at": 1700000000000
  }
}
```

**Error (404):**
```json
{
  "error": "Message not found"
}
```

---

### Bulk Lookup
```
POST /messages/lookup
```
Check if multiple recipients have been contacted from a specific subscription. Returns contact status for each phone in a single query.

**Request Body:**
```json
{
  "subscription": "1",
  "phones": ["+61400000001", "+61400000002", "+61400000003"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| subscription | string | Yes | Subscription/SIM ID to check |
| phones | string[] | Yes | Array of phone numbers to check |

**Response:**
```json
{
  "success": true,
  "subscription_id": "1",
  "results": {
    "+61400000001": { "contacted": true, "message_count": 5, "last_sent": 1700000000000 },
    "+61400000002": { "contacted": false },
    "+61400000003": { "contacted": true, "message_count": 2, "last_sent": 1699000000000 }
  },
  "summary": {
    "total_checked": 3,
    "contacted": 2,
    "not_contacted": 1
  }
}
```

**Result Fields:**
- `contacted` - Whether any messages were sent to this phone
- `message_count` - Number of messages sent (only if contacted)
- `last_sent` - Timestamp of most recent sent message (only if contacted)

---

### List Calls
```
GET /calls
```
List call history, optionally filtered by phone number and subscription/SIM.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| phone | string | No | Phone number to filter by |
| limit | int | No | Max results (default: 100, max: 500) |
| offset | int | No | Pagination offset (default: 0) |
| subscription | string | No | Filter by subscription/SIM ID |
| include | string | No | Set to `messages` to include SMS history (requires phone) |

**Response (all calls):**
```json
{
  "success": true,
  "data": [
    {
      "id": "xyz789abc123",
      "phone": "+61400000000",
      "phone_raw": "0400000000",
      "call_type": "incoming",
      "duration": 245,
      "timestamp": 1700000000000,
      "readable_date": "Nov 15, 2024 2:30:45 PM",
      "contact_name": "John Doe",
      "subscription_id": "1",
      "created_at": 1700000000000
    }
  ],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "count": 75
  }
}
```

**Response (filtered by phone):**
```json
{
  "success": true,
  "phone": "+61400000000",
  "subscription_id": null,
  "data": [...],
  "pagination": {...}
}
```

**Call Type Values:**
- `incoming` - Received call
- `outgoing` - Made call
- `missed` - Missed call
- `voicemail` - Voicemail
- `rejected` - Rejected call
- `blocked` - Blocked call

---

### Get Single Call
```
GET /calls/:id
```
Get a specific call by ID.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "xyz789abc123",
    "phone": "+61400000000",
    "phone_raw": "0400000000",
    "call_type": "incoming",
    "duration": 245,
    "timestamp": 1700000000000,
    "readable_date": "Nov 15, 2024 2:30:45 PM",
    "contact_name": "John Doe",
    "created_at": 1700000000000
  }
}
```

**Error (404):**
```json
{
  "error": "Call not found"
}
```

---

### List Subscriptions
```
GET /subscriptions
```
List all SIM/subscription configurations.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| active | string | true | Set to `false` to include inactive subscriptions |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "subscription_id": "1",
      "phone_number": "+61450123456",
      "label": "Personal SIM",
      "is_active": 1,
      "created_at": 1700000000000,
      "updated_at": 1700000000000
    }
  ],
  "count": 2
}
```

---

### Discover Subscriptions
```
POST /subscriptions/discover
```
Auto-discover subscription IDs from existing message and call data. Creates entries with default labels for any new subscriptions found.

**Response:**
```json
{
  "success": true,
  "discovered": ["1", "4", "11"],
  "count": 3,
  "message": "Subscriptions auto-discovered and registered"
}
```

---

### Get Subscription
```
GET /subscriptions/:id
```
Get a specific subscription by ID.

**Response:**
```json
{
  "success": true,
  "data": {
    "subscription_id": "1",
    "phone_number": "+61450123456",
    "label": "Personal SIM",
    "is_active": 1,
    "created_at": 1700000000000,
    "updated_at": 1700000000000
  }
}
```

**Error (404):**
```json
{
  "error": "Subscription not found"
}
```

---

### Create/Update Subscription
```
PUT /subscriptions/:id
```
Create a new subscription or update an existing one.

**Request Body:**
```json
{
  "label": "Personal SIM",
  "phone_number": "+61450123456",
  "is_active": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| label | string | Yes | Human-readable name for the subscription |
| phone_number | string | No | Phone number associated with this SIM |
| is_active | boolean | No | Whether subscription is active |

**Response:**
```json
{
  "success": true,
  "updated": true,
  "subscription_id": "1"
}
```

---

### Delete Subscription
```
DELETE /subscriptions/:id
```
Soft delete a subscription (sets is_active to 0).

**Response:**
```json
{
  "success": true,
  "message": "Subscription deactivated"
}
```

**Error (404):**
```json
{
  "error": "Subscription not found"
}
```

---

## Error Responses

All endpoints may return:

**400 Bad Request:**
```json
{
  "error": "Description of the error"
}
```

**401 Unauthorized:**
```json
{
  "error": "Unauthorized"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Failed to process request"
}
```

---

## Phone Number Format

- Phone numbers are normalized to E.164 format (e.g., `+61400000000`)
- Both raw and normalized versions are stored
- Queries accept any format and auto-normalize
