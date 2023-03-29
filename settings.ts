import { type Attributes } from "@opentelemetry/api";
import { Meteor } from "meteor/meteor";

export const settings: {
  enabled?: boolean;
  otlpEndpoint?: string;
  serverResourceAttributes?: Attributes;
  clientResourceAttributes?: Attributes;
  enhancedDbReporting?: boolean;
} = {
  ...Meteor.settings.packages?.["danopia:opentelemetry"] ?? {},
};

// special-casing for particular deployment environments..

// underneath datadog, we add some default settings following their conventions
// we also enable-by-default if an agent host is provided
if (process.env['DD_VERSION']) {
  settings.serverResourceAttributes ??= {};
  settings.serverResourceAttributes['service.name'] ??= process.env['DD_SERVICE'];
  settings.serverResourceAttributes['service.version'] ??= process.env['DD_VERSION'];
  settings.serverResourceAttributes['deployment.environment'] ??= process.env['DD_ENV'];

  settings.clientResourceAttributes ??= {};
  settings.clientResourceAttributes['service.name'] ??= `${process.env['DD_SERVICE']}-browser`;
  // TODO: version needs to come from the client bundle, otherwise it's a lie
  // settings.clientResourceAttributes['service.version'] ??= process.env['DD_VERSION'];
  settings.clientResourceAttributes['deployment.environment'] ??= process.env['DD_ENV'];

  const agentHost = process.env['DD_AGENT_HOST'];
  if (agentHost) {
    settings.enabled ??= true;
    settings.otlpEndpoint ??= `http://${agentHost}:4318`;
  }

} else if (process.env['OTEL_EXPORTER_OTLP_ENDPOINT']) {
  settings.enabled ??= true;
}
