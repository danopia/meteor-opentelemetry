import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

import { Meteor } from "meteor/meteor";
import { BatchSpanProcessor, WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { Resource } from '@opentelemetry/resources';

import { DDPSpanExporter } from "./ddp-otlp-client";
import './instrument/ddp-client'

export const resource = new Resource({
  'session.host': document.location.host,
  'session.id': crypto.randomUUID(),
  'browser.languages': [...navigator.languages],
  'service.version': Meteor.gitCommitHash,
  // vvv https://opentelemetry.io/docs/reference/specification/resource/semantic_conventions/browser/
  'browser.brands': navigator.userAgentData?.brands?.map(x => `${x.brand} ${x.version}`) ?? [],
  'browser.platform': navigator.userAgentData?.platform,
  'browser.mobile': navigator.userAgentData?.mobile,
  'browser.language': navigator.language,
  'user_agent.original': navigator.userAgent,
});

export const tracer = new WebTracerProvider({
  resource,
  spanProcessors: [
    new BatchSpanProcessor(new DDPSpanExporter()),
  ],
});
tracer.register();
