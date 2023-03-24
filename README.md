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

## Browser Setup

Optionally, you can import this package from your client entrypoint to gather in-browser telemetry
including client-to-server DDP tracing.

This package will submit OpenTelemetry payloads over Meteor's existing DDP connection,
using your application server as a proxy,
instead of having every browser talking directly to your `otelcol` endpoint and thus needing CORS configuration.

Example snippit for your `client.ts` file:

```ts
// Set up an OpenTelemetry provider using DDP submission and tracing
// (required to have client-to-server DDP tracing)
import 'meteor/danopia:opentelemetry';

// Register additional browser-side instrumentations
// (optional)
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { UserInteractionInstrumentation } from '@opentelemetry/instrumentation-user-interaction';
registerInstrumentations({
  instrumentations: [
    new UserInteractionInstrumentation(),
  ],
});
```

## Example `settings.json`

OTLP environment variables are tolerated;
for example, these variables will enable tracing:

```sh
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4218
OTEL_SERVICE_NAME=
```

You can also enable this library and supply configuration via Meteor settings:

```json
{
  "packages": {
    "danopia:opentelemetry": {
      "enabled": true,
      "serverResourceAttributes": {
        "service.name": "my-app",
        "deployment.environment": "local"
      },
      "clientResourceAttributes": {
        "service.name": "my-app-browser",
        "deployment.environment": "local"
      }
    }
  }
}
```

Note that OpenTelemetry defines a number of environment variables such as
`OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_RESOURCE_ATTRIBUTES`.
Since `meteor-opentelemetry` submits traces thru DDP,
OpenTelemetry wants to treat client and server data similarly.
So it might be desirable to set resource attributes via Meteor settings:

```json
{
  "packages": {
    "danopia:opentelemetry": {
      "enabled": true,
      "serverResourceAttributes": {
        "service.name": "my-app",
        "deployment.environment": "local"
      },
      "clientResourceAttributes": {
        "service.name": "my-app-browser",
        "deployment.environment": "local"
      }
    }
  }
}
```
