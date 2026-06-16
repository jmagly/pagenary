# Pagination

List endpoints return a page of [Resources](#resources) plus a cursor. Follow the
cursor until it is empty. Oversized pages are rejected with the [Errors](#errors)
shape, and rapid paging counts against [Rate Limits](#rate-limits).

## Related

- [Resources](#resources)
- [Errors](#errors)
- [Rate Limits](#rate-limits)
