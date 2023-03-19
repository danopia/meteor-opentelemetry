import { DDP, DDPCommon } from "meteor/ddp";
import { Meteor } from "meteor/meteor";

import { context, propagation, SpanKind, trace } from "@opentelemetry/api";

// We hook the DDP apply

const methodTracer = trace.getTracer('ddp.method');
const subTracer = trace.getTracer('ddp.subscription');


const ddp = Meteor.connection as ReturnType<typeof DDP.connect>;
console.log('welcome', ddp.status())

// const origSend = ddp._send;
// ddp._send = function (obj: Record<string,unknown>) {
//   const ctx = context.active();
//   const baggage: Record<string,string> = {};
//   propagation.inject(ctx, baggage, {
//     set: (h, k, v) => h[k] = typeof v === 'string' ? v : String(v),
//   });
//   origSend.call(this, {
//     ...obj,
//     baggage,
//   });
// }
const origApply = ddp._apply
ddp._apply = function _apply(this: typeof ddp, name, stubCallValue, args, options, callback) {
  return methodTracer.startActiveSpan(name, {
    kind: SpanKind.CLIENT,
    attributes: {
      'rpc.system': 'ddp',
      'rpc.method': name,
      'rpc.ddp.session': this.id,
      'rpc.ddp.version': this.version,
      // 'rpc.ddp.method_id': payload.id,
  // 'ddp.user_id': this.userId ?? '',
      // 'ddp.connection': this.connection?.id,
    },
  }, span => {
    origApply.call(this, name, stubCallValue, args, options, callback);
    // span.end();
  });
};

const origSend = ddp._send
ddp._send = function _send(this: typeof ddp, payload) {
  if (payload.msg !== 'sub') {
    return origSend.call(this, payload);
  }
  // console.log('innft', payload)

  const span = subTracer.startSpan(payload.name, {
    kind: SpanKind.CLIENT,
    attributes: {
      'rpc.system': 'ddp-subscribe',
      'rpc.method': payload.name,
      'rpc.ddp.session': this.id,
      'rpc.ddp.version': this.version,
      'rpc.ddp.sub_id': payload.id,
      // 'ddp.user_id': this.userId ?? '',
      // 'ddp.connection': this.connection?.id,
    },
  }, context.active());
  this._subscriptions[payload.id].otelSpan = span;

  const origCallback = this._subscriptions[payload.id].readyCallback;
  this._subscriptions[payload.id].readyCallback = () => {
    span.end();
    origCallback?.();
  }
  const origErrCallback = this._subscriptions[payload.id].errorCallback;
  this._subscriptions[payload.id].errorCallback = (err) => {
    span.recordException(err);
    span.end();
    origErrCallback?.(err);
  }

  const baggage: Record<string,string> = {};
  propagation.inject(trace.setSpan(context.active(), span), baggage, {
    set: (h, k, v) => h[k] = typeof v === 'string' ? v : String(v),
  });
  payload.baggage = baggage;

  origSend.call(this, payload);
};

const origMethodInvokers = ddp._methodInvokers;
ddp._methodInvokers = new Proxy<Record<string|symbol,{
  methodId: number,
  _onResultReceived: () => void;
}>>(origMethodInvokers, {
  set(self,key, value) {
    const ctx = context.active();
    const span = trace.getActiveSpan();
    const baggage: Record<string,string> = {};
    propagation.inject(ctx, baggage, {
      set: (h, k, v) => h[k] = typeof v === 'string' ? v : String(v),
    });
    value._message.baggage = baggage;
    const origCb = value._onResultReceived;
    value._onResultReceived = () => {
      span?.end();
      origCb();
    }
    // console.log('set method invoker', {self, key, value})
    self[key] = value;
    return true;
  }
})
