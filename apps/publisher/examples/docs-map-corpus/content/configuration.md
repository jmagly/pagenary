# Configuration

Configure environment, base URL, and webhook endpoints once. The CLI reads these
after [Installation](#installation), and the same values authorize requests per
[Authentication](#authentication).

```toml
[lumen]
env = "production"
webhook_url = "https://example.com/hooks"
```

## Related

- [Installation](#installation)
- [Authentication](#authentication)
