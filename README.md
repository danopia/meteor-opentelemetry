# `danopia:opentelemetry`

This Meteor package hooks up OpenTelemetry (and OTLP-JSON) within a Meteor app.
It should help with reporting distributed traces to modern APM products from your existing Meteor app.
DDP methods and subscriptions will be instrumented between the client and the server programs.

## Meteor Major Versions

**The last release of this package to target Meteor 2.x is `0.6.2`.**

Currently, version `0.7.0-beta2` is targetting Meteor 3.0.
It will be promoted to a stable release after enough real-world testing.

### For Meteor 2.x Apps
Meteor 2 used Fibers instead of async/await, and
this has meant that Meteor 2 could not leverage the usual NodeJS tracing implementations.

The tracer in this library is customized for
Meteor 2's quirky and incompatible way of executing async code.

Regardless, I recommend trying a Meteor 3 migration
to modernize your app server and align it with the wider NodeJS ecosystem.

### For Meteor 3.x Apps
Meteor 3.0 is officially out and should resolve Meteor's incompatibilities with existing APM libraries.
So the need for this library is partially replaced by the Meteor 3 update.

However, this library also provides several OpenTelemetry integrations and APIs
which are still useful in Meteor 3.

## NodeJS Instrumentation setup

If you'd like to benefit from the standard NodeJS instrumentations
such as HTTP and gRPC, install and register them directly.
This way you choose your dependencies and how they are configured.

For the full instrumentation suite, install
[the meta package](https://www.npmjs.com/package/@opentelemetry/auto-instrumentations-node):

`meteor npm i --save @opentelemetry/auto-instrumentations-node @opentelemetry/instrumentation`

(Note that on Meteor 2.x, some auto-instrumentations don't hook up right, and might lack span parents, or might not register at all)

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
