import { DDP } from "meteor/ddp";
import { Meteor } from "meteor/meteor";

import { BatchSpanProcessor, Tracer, WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { Resource } from '@opentelemetry/resources';
// import { MeteorContextManager } from "/imports/opentelemetry/context-manager";
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { context, propagation, SpanKind, trace } from "@opentelemetry/api";
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
// import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load';
import { UserInteractionInstrumentation } from '@opentelemetry/instrumentation-user-interaction';

import './instrument/ddp-client'

const settings: {
  otlpEndpoint?: string;
  resourceAttributes?: Record<string,unknown>;
} = Meteor.settings.public.packages?.["danopia:opentelemetry"] ?? {};

if (settings.otlpEndpoint) {
  const provider = new WebTracerProvider({
    resource: new Resource({
      'session.host': document.location.host,
      'session.id': crypto.randomUUID(),
      'browser.languages': [...navigator.languages],
      // vvv https://opentelemetry.io/docs/reference/specification/resource/semantic_conventions/browser/
      'browser.brands': navigator.userAgentData?.brands?.map(x => `${x.brand} ${x.version}`) ?? [],
      'browser.platform':navigator.userAgentData?.platform,
      'browser.mobile': navigator.userAgentData?.mobile,
      'browser.language': navigator.language,
      'user_agent.original': navigator.userAgent,
      // vvv whatever the settings want
      ...(settings.resourceAttributes ?? {}),
    }),
  });

  provider.addSpanProcessor(new BatchSpanProcessor(new OTLPTraceExporter({
    url: new URL('v1/traces', settings.otlpEndpoint).toString(),
  })));

  provider.register({
    // contextManager: new MeteorContextManager(),
  });

  // Registering instrumentations
  registerInstrumentations({
    instrumentations: [
      // new DocumentLoadInstrumentation(),
      new UserInteractionInstrumentation(),
    ],
  });

}
