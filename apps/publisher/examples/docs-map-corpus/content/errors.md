# Errors

Every error shares one JSON shape: a `code`, a human `message`, and a `request_id`.
Authorization failures point back to [Authentication](#authentication), quota
failures to [Rate Limits](#rate-limits), and delivery failures appear in your
[Webhooks](#webhooks) log.

## Related

- [Authentication](#authentication)
- [Rate Limits](#rate-limits)
- [Webhooks](#webhooks)
