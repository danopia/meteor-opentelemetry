# WIP

## Example `settings.json`

Note that only the server's OTel can be configured by environment variables.
The client configuration can only be applied via `settings.json`.

```json
{
  "packages": {
    "danopia:opentelemetry": {
      "enabled": true,
      "resourceAttributes": {
        "service.name": "my-app",
        "deployment.environment": "local"
      }
    }
  },
  "public": {
    "packages": {
      "danopia:opentelemetry": {
        "enabled": true,
        "resourceAttributes": {
          "service.name": "my-app-web",
          "deployment.environment": "local"
        },
        "otlpEndpoint": "https://some-public-otel-collector"
      }
    }
  }
}
```
