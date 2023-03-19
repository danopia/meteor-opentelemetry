Package.describe({
  name: 'danopia:opentelemetry',
  version: '0.1.1',
  summary: 'Meteor instrumentations for OpenTelemetry tracing',
  git: 'https://github.com/danopia/meteor-opentelemetry',
  documentation: 'README.md',
});

Npm.depends({
  '@opentelemetry/api': '1.4.1',
  '@opentelemetry/sdk-trace-node': '1.10.0',
  '@opentelemetry/sdk-trace-web': '1.10.0',
  '@opentelemetry/semantic-conventions': '1.10.0',
  '@opentelemetry/exporter-trace-otlp-http': '0.36.0',
  '@opentelemetry/exporter-metrics-otlp-http': '0.36.0',
  '@opentelemetry/instrumentation-http': '0.36.0',
  '@opentelemetry/instrumentation-user-interaction': '0.32.1',
});

Package.onUse(function(api) {
  api.versionsFrom('2.10.0');
  api.use('ecmascript');
  api.use('typescript');
  api.use('montiapm:meteorx@2.2.0');
  api.mainModule('opentelemetry-client.js', 'client');
  api.mainModule('opentelemetry-server.js', 'server')
});

Package.onTest(function(api) {
  api.use('ecmascript');
  api.use('tinytest');
  api.use('danopia:opentelemetry');
  api.mainModule('opentelemetry-tests.js');
});
