import { WebApp } from 'meteor/webapp';
import { context, trace, Span, SpanKind, ROOT_CONTEXT } from '@opentelemetry/api';
import type { IncomingMessage } from 'http';

// For WebApp, we simply pass the outside span thru into Meteor's interior context
// This depends on the standard http instrumentation to create the actual request spans

const reqMap = new WeakMap<IncomingMessage,Span>();

WebApp.rawConnectHandlers.use((req, resp, next) => {
  // console.log('raw', req.url, trace.getActiveSpan())
  reqMap.set(req, trace.getActiveSpan());
  next();
})

WebApp.connectHandlers.use((req, resp, next) => {
  // console.log('main', req.url, trace.getActiveSpan(), reqMap.get(req))
  const span = reqMap.get(req);
  if (span) {
    context.with(trace.setSpan(ROOT_CONTEXT, span), next);
  } else {
    next();
  }
})

// We deserve to be first... I presume
WebApp.rawConnectHandlers.stack.unshift(WebApp.rawConnectHandlers.stack.pop()!);
WebApp.connectHandlers.stack.unshift(WebApp.connectHandlers.stack.pop()!);




// const tracer = trace.getTracer('webapp');
// WebApp.connectHandlers.use(function (req,resp,next) {
//   console.log(req.method, req.url);
//   const span = tracer.startSpan('webapp', {
//     kind: SpanKind.SERVER,
//     attributes: {
//       'http.method': req.method,
//       'http.url': req.url,
//     },
//   }, ROOT_CONTEXT);
//   // resp.once('finish', () => {
//   //   console.log('finish span', span.isRecording());
//   //   span.end();
//   // });
//   resp.once('close', () => {
//     // console.log('close span', span.isRecording());
//     span.end();
//   });
//   // span.end();
//   context.with(trace.setSpan(ROOT_CONTEXT, span), () => {
//     next();
//   });
// })



// import { WebApp } from 'meteor/webapp';
// import { context, trace, SpanKind, ROOT_CONTEXT } from '@opentelemetry/api';

// const tracer = trace.getTracer('webapp');
// const opentelemetry = (req,resp,next) => {
//   const span = tracer.startSpan('webapp', {
//     kind: SpanKind.SERVER,
//     attributes: {
//       'http.method': req.method,
//       'http.url': req.url,
//     },
//   }, ROOT_CONTEXT);
//   console.log(req.method, req.url, span.spanContext());
//   // resp.once('finish', () => {
//   //   console.log('finish span', span.isRecording());
//   //   span.end();
//   // });
//   resp.once('close', () => {
//     // console.log('close span', span.isRecording());
//     span.end();
//   });
//   // span.end();
//   context.with(trace.setSpan(ROOT_CONTEXT, span), () => {
//     next();
//   });
// }

// // WebApp.connectHandlers.stack.splice(2, 0, {route: '', handle: opentelemetry });
// // WebApp.connectHandlers.stack.splice(3, 0, {route: '', handle: opentelemetry });
// WebApp.connectHandlers.use(opentelemetry)
