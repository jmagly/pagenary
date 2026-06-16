# Webhooks

Webhooks deliver [Event Types](#events) to your endpoint as resources change.
Delivery failures are retried with backoff (see [Rate Limits](#rate-limits)), and
non-2xx responses are recorded as [Errors](#errors). Configure endpoints in
[Configuration](#configuration).

## Related

- [Event Types](#events)
- [Rate Limits](#rate-limits)
- [Errors](#errors)
- [Configuration](#configuration)
