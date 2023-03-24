import { Attributes, diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

import { BatchSpanProcessor, NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader, AggregationTemporality, MeterProvider } from '@opentelemetry/sdk-metrics';
import { IExportTraceServiceRequest, IKeyValue } from '@opentelemetry/otlp-transformer';
import { sendWithHttp } from '@opentelemetry/otlp-exporter-base';

import { MeteorContextManager } from "./server/context-manager";

import { wrapFibers } from './instrument/fibers'
import './instrument/ddp-server'
import './instrument/webapp'
import './instrument/mongodb'
import { Meteor } from "meteor/meteor";
import { check } from "meteor/check";

const settings: {
  enabled?: boolean;
  otlpEndpoint?: string;
  serverResourceAttributes?: Attributes;
  clientResourceAttributes?: Attributes;
} = Meteor.settings.packages?.["danopia:opentelemetry"] ?? {};

if (settings.enabled) {

  const clientExporter = new OTLPTraceExporter();

  const clientResources = new Resource(settings.clientResourceAttributes ?? {});
  clientResources.attributes['service.name'] ??= `unknown_service-web`;
  const clientAttributeList = Object.entries(clientResources.attributes).map<IKeyValue>(x => ({
    key: x[0],
    value: { stringValue: `${x[1]}` },
  }));

  Meteor.methods({
    async 'OTLP/v1/traces'(tracePayload: IExportTraceServiceRequest) {
      check(tracePayload, {
        resourceSpans: Array,
      });
      for (const x of tracePayload.resourceSpans) {
        x.resource ??= { attributes: [], droppedAttributesCount: 0 };
        x.resource.attributes = [
          { key: 'session.public_ip', value: { stringValue: this.connection?.clientAddress } },
          ...clientAttributeList,
          ...x.resource.attributes.filter(x => x.key !== 'service.name'),
        ];
      }
      await new Promise<void>((ok, fail) =>
        sendWithHttp(clientExporter, JSON.stringify(tracePayload), 'application/json', ok, fail));
    },
  });

  const resource = new Resource(settings.serverResourceAttributes ?? {});

  const metricsProvider = new MeterProvider({
    resource,
  });
  metricsProvider.addMetricReader(new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      temporalityPreference: AggregationTemporality.DELTA,
    }),
    exportIntervalMillis: 10_000,
  }));

  const provider = new NodeTracerProvider({
    resource,
  });
  const contextManager = new MeteorContextManager().enable();
  provider.addSpanProcessor(new BatchSpanProcessor(new OTLPTraceExporter()));
  provider.register({
    contextManager,
  });

  registerInstrumentations({
    tracerProvider: provider,
    meterProvider: metricsProvider,
  })

  wrapFibers(); // apparently needs to happen after the metrics provider is set up
}
