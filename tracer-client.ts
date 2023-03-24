import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

// import { DDP } from "meteor/ddp";
import { Meteor } from "meteor/meteor";

import { BatchSpanProcessor, WebTracerProvider, SpanExporter, ReadableSpan } from '@opentelemetry/sdk-trace-web';
import { Resource } from '@opentelemetry/resources';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { ExportResultCode } from "@opentelemetry/core";
import { createExportTraceServiceRequest } from '@opentelemetry/otlp-transformer';

import { UserInteractionInstrumentation } from '@opentelemetry/instrumentation-user-interaction';

import './instrument/ddp-client'
import { ExportResult } from "@opentelemetry/core";

class DDPSpanExporter implements SpanExporter {
  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    const req = createExportTraceServiceRequest(spans, true);
    Meteor.callAsync('OTLP/v1/traces', req)
      .then<ExportResult,ExportResult>(
        () => ({ code: ExportResultCode.SUCCESS }),
        err => ({ code: ExportResultCode.FAILED, error: err }))
      .then(resultCallback);
  }
  async shutdown(): Promise<void> {}
}

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
  }),
});

provider.addSpanProcessor(new BatchSpanProcessor(new DDPSpanExporter()));

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
