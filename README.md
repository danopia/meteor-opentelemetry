# WIP

## NodeJS Instrumentation setup

If you'd like to benefit from the standard NodeJS instrumentations
such as HTTP and gRPC, install and register them directly.
This way you choose your dependencies and how they are configured.

For the full instrumentation suite, install
[the meta package](https://www.npmjs.com/package/@opentelemetry/auto-instrumentations-node):

`meteor npm i --save @opentelemetry/auto-instrumentations-node @opentelemetry/instrumentation`

Now you just need to configure the instrumentations.
For example, this server file disables `fs` and also skips HTTP healthchecks:

```ts
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

registerInstrumentations({
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': {
        ignoreIncomingRequestHook(req) {
          if (req.url == '/healthz' || req.url == '/readyz') return true;
          if (req.url?.startsWith('/sockjs/')) return true;
          return false;
        },
      },
      '@opentelemetry/instrumentation-fs': {
        enabled: false,
      },
    }),
  ],
});
```

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
