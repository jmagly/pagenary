# Rate Limits

Each plan has a request quota per minute. Exceeding it returns a `429` in the
[Errors](#errors) shape with a `Retry-After` header. Spread load across
[API Keys](#api-keys) and respect backoff when receiving [Webhooks](#webhooks)
retries.

## Related

- [Errors](#errors)
- [API Keys](#api-keys)
- [Webhooks](#webhooks)
