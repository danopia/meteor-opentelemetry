Package.describe({
  name: 'danopia:opentelemetry',
  version: '0.9.1',
  summary: 'Meteor v3 instrumentations for OpenTelemetry tracing',
  git: 'https://github.com/danopia/meteor-opentelemetry',
  documentation: 'README.md',
});

Npm.depends({

  // This needs to be a sort of peer dependency
  // TODO: consider https://github.com/Meteor-Community-Packages/check-npm-versions
  // '@opentelemetry/api': '1.9.0',

  '@opentelemetry/sdk-trace-node': '2.0.0',
  '@opentelemetry/sdk-trace-web': '2.0.0',
  '@opentelemetry/semantic-conventions': '1.30.0',

  '@opentelemetry/otlp-transformer': '0.200.0',
  '@opentelemetry/exporter-trace-otlp-http': '0.200.0',
  '@opentelemetry/exporter-metrics-otlp-http': '0.200.0',
  '@opentelemetry/exporter-logs-otlp-http': '0.200.0',

  // TODO: consider replacing our mongodb instrumentation with:
  // '@opentelemetry/instrumentation-mongodb': '',

});

Package.onUse(function(api) {
  api.versionsFrom('3.0');
  api.use('ecmascript');
  api.use('montiapm:meteorx@2.3.1');
  api.export('resource');
  api.export('tracer');
  api.mainModule('opentelemetry-client.js', 'client');
  api.mainModule('opentelemetry-server.js', 'server');

  // TypeScript setup
  api.use('typescript');
  api.use('zodern:types@1.0.13');
});

Package.onTest(function(api) {
  api.use('ecmascript');
  api.use('tinytest');
  api.use('danopia:opentelemetry');
  api.mainModule('opentelemetry-tests.js');
});
