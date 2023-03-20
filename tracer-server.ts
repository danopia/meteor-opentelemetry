import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO)

// import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor, NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
// import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { registerInstrumentations } from '@opentelemetry/instrumentation';

// import { MongoDBInstrumentation } from "@opentelemetry/instrumentation-mongodb"


import { MeteorContextManager } from "./server/context-manager";


import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader, AggregationTemporality } from '@opentelemetry/sdk-metrics';
import { MeterProvider } from '@opentelemetry/sdk-metrics';

import { wrapFibers } from './instrument/fibers'
import './instrument/ddp-server'
import './instrument/webapp'
import './instrument/mongodb'
import { Meteor } from "meteor/meteor";

const settings: {
  enabled?: boolean;
  otlpEndpoint?: string;
  resourceAttributes?: Record<string,unknown>;
  autoInstrument?: Record<string,Record<string,unknown>>;
} = Meteor.settings.packages?.["danopia:opentelemetry"] ?? {};

if (settings.enabled) {

  const resource = new Resource(settings.resourceAttributes ?? {});

  const metricsProvider = new MeterProvider({
    resource,
  });
  metricsProvider.addMetricReader(new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      temporalityPreference: AggregationTemporality.DELTA,
    }),
    exportIntervalMillis: 5000,
  }));

  const provider = new NodeTracerProvider({
    resource,
  });
  const contextManager = new MeteorContextManager().enable();
  provider.addSpanProcessor(new BatchSpanProcessor(new OTLPTraceExporter()));
  // provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
  provider.register({
    contextManager,
  });

  registerInstrumentations({
    tracerProvider: provider,
    meterProvider: metricsProvider,
  })

  wrapFibers(); // apparently needs to happen after the metrics provider is set up
}
