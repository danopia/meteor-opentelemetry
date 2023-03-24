import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

import { BatchSpanProcessor, WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { Resource } from '@opentelemetry/resources';

import { DDPSpanExporter } from "./ddp-otlp-client";
import './instrument/ddp-client'

const resource = new Resource({
  'session.host': document.location.host,
  'session.id': crypto.randomUUID(),
  'browser.languages': [...navigator.languages],
  // vvv https://opentelemetry.io/docs/reference/specification/resource/semantic_conventions/browser/
  'browser.brands': navigator.userAgentData?.brands?.map(x => `${x.brand} ${x.version}`) ?? [],
  'browser.platform':navigator.userAgentData?.platform,
  'browser.mobile': navigator.userAgentData?.mobile,
  'browser.language': navigator.language,
  'user_agent.original': navigator.userAgent,
});

const provider = new WebTracerProvider({
  resource,
});
provider.addSpanProcessor(new BatchSpanProcessor(new DDPSpanExporter()));
provider.register({
  // contextManager: new MeteorContextManager(),
});
