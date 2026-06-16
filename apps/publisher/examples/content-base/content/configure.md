# Configure

All customization lives in a tenant `config.json`. The keys you'll reach for most:

| Key | What it controls |
| --- | --- |
| `accentColor` | The primary accent used across links and highlights |
| `theme` | A preset (`light`, `dark`, `matrix`) or a custom color object |
| `fontBody` / `fontMono` | Typography for prose and code |
| `navPosition` | Where navigation sits: `left`, `right`, `top`, `bottom`, `hybrid` |
| `brandMark` / `brandSub` | The two-part wordmark in the header |

Change one key, rebuild, and the whole site follows. No template forks, no CSS
surgery.

## Example

```json
{
  "brandMark": "Acme",
  "brandSub": "Docs",
  "accentColor": "#2563eb",
  "navPosition": "top"
}
```
