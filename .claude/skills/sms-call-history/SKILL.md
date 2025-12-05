---
name: sms-call-history
description: "Query SMS messages and call history from the backup API. Use this skill when the user wants to search messages, view call logs, list phone contacts, analyze communication history, or filter by SIM/subscription."
---

# SMS & Call History Query Skill

This skill enables querying SMS messages and call history from the marketing SMS backup API. Supports multi-SIM tracking to filter communications by which phone number/SIM was used.

## Setup

Read the API configuration from the `.env` file in this skill folder (`.claude/skills/sms-call-history/.env`):
- `CLOUDFLARE_MARKETING_SMS_API_KEY` - API key for authentication
- `CLOUDFLARE_MARKETING_SMS_API_URL` - Base URL for the API

## Authentication

All API requests require the `X-API-Key` header:
```bash
curl -H "X-API-Key: $API_KEY" "$API_URL/endpoint"
```

## Common Operations

### List All Phone Numbers
To see all contacts with their message and call statistics:
```bash
curl -s -H "X-API-Key: $API_KEY" "$API_URL/phones?limit=100" | jq .
```

### Get Messages for a Phone Number
To retrieve SMS/MMS messages for a specific phone:
```bash
curl -s -H "X-API-Key: $API_KEY" "$API_URL/messages?phone=+61400000000&limit=50" | jq .
```

### Get All Calls
To list all call history:
```bash
curl -s -H "X-API-Key: $API_KEY" "$API_URL/calls?limit=50" | jq .
```

### Get Calls for a Specific Phone
To filter calls by phone number:
```bash
curl -s -H "X-API-Key: $API_KEY" "$API_URL/calls?phone=+61400000000&limit=50" | jq .
```

### Get Combined Messages and Calls
To get both messages and calls for a phone number in one request:
```bash
curl -s -H "X-API-Key: $API_KEY" "$API_URL/messages?phone=+61400000000&include=calls" | jq .
```

## Subscription/SIM Management

For users with multiple SIM cards, you can track and filter by which SIM was used.

### Discover Subscriptions
Auto-discover all subscription IDs from uploaded data:
```bash
curl -s -X POST -H "X-API-Key: $API_KEY" "$API_URL/subscriptions/discover" | jq .
```

### List Subscriptions
View all registered subscriptions:
```bash
curl -s -H "X-API-Key: $API_KEY" "$API_URL/subscriptions" | jq .
```

### Label a Subscription
Give a subscription a friendly name and associate a phone number:
```bash
curl -s -X PUT -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  "$API_URL/subscriptions/1" \
  -d '{"label": "Personal SIM", "phone_number": "+61450123456"}' | jq .
```

### Filter Messages by Subscription
Get messages for a phone number from a specific SIM:
```bash
curl -s -H "X-API-Key: $API_KEY" "$API_URL/messages?phone=+61400000000&subscription=1" | jq .
```

### Filter Combined History by Subscription
Get both messages and calls for a phone filtered by SIM:
```bash
curl -s -H "X-API-Key: $API_KEY" "$API_URL/messages?phone=+61400000000&subscription=1&include=calls" | jq .
```

## Bulk Lookup

Check if multiple recipients have been contacted from a specific subscription in a single query:
```bash
curl -s -X POST -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  "$API_URL/messages/lookup" \
  -d '{"subscription": "1", "phones": ["+61400000001", "+61400000002", "+61400000003"]}' | jq .
```

Response includes for each phone: whether contacted, message count, and last sent timestamp.

## Response Data

### Message Fields
- `id` - Unique message identifier
- `phone` - Normalized phone number (E.164 format)
- `type` - Message type: `sms` or `mms`
- `direction` - `received` or `sent`
- `body` - Message content
- `timestamp` - Unix timestamp in milliseconds
- `contact_name` - Contact name if available
- `subscription_id` - SIM/subscription identifier (for multi-SIM tracking)
- `sim_slot` - SIM slot from webhook (real-time messages only)

### Call Fields
- `id` - Unique call identifier
- `phone` - Normalized phone number
- `call_type` - `incoming`, `outgoing`, `missed`, `voicemail`, `rejected`, or `blocked`
- `duration` - Call duration in seconds
- `timestamp` - Unix timestamp in milliseconds
- `contact_name` - Contact name if available
- `subscription_id` - SIM/subscription identifier (for multi-SIM tracking)

### Subscription Fields
- `subscription_id` - Unique subscription/SIM identifier
- `phone_number` - Phone number associated with this SIM
- `label` - User-defined label (e.g., "Personal SIM", "Work SIM")
- `is_active` - Whether subscription is active (1) or deleted (0)

### Phone Statistics Fields
- `phone` - Normalized phone number
- `display_name` - Contact name
- `message_count` - Total messages with this phone
- `call_count` - Total calls with this phone
- `last_message_at` - Timestamp of most recent message
- `last_call_at` - Timestamp of most recent call

## Pagination

All list endpoints support pagination:
- `limit` - Maximum results (default: 100, max: 500)
- `offset` - Skip first N results (default: 0)

## Reference

For complete API documentation, see `references/api-reference.md`.
