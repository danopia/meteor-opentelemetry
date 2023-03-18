import { trace, propagation, ROOT_CONTEXT, SpanKind, SpanStatusCode } from "@opentelemetry/api";
import { Meteor } from "meteor/meteor";

{ // Hook receiving rpcs from the client
  const {protocol_handlers} = MeteorX.Session.prototype;
  const originMethod = protocol_handlers.method;
  const methodtracer = trace.getTracer('ddp.method')
  protocol_handlers.method = function (payload, unblock) {
    if (payload.msg == 'method') {
      const ctx = propagation.extract(ROOT_CONTEXT, payload.baggage ?? {}, {
        get(h,k) { return h[k]; },
        keys(h) { return Object.keys(h); },
      });

      return methodtracer.startActiveSpan(payload.method, {
        kind: SpanKind.SERVER,
        attributes: {
          'rpc.system': 'ddp',
          'rpc.method': payload.method,
          'rpc.ddp.session': this.id,
          'rpc.ddp.version': this.version,
          'rpc.ddp.method_id': payload.id,
          'meteor.user_id': this.userId,
          'net.peer.name': this.socket.remoteAddress,
          'net.peer.port': this.socket.remotePort,
          'net.host.name': this.socket.address.address,
          'net.host.port': this.socket.address.port,
          'net.sock.family': ({'IPv4':'inet','IPv6':'inet6'})[this.socket.address.family] ?? this.socket.address.family,
        },
      }, ctx, () => originMethod.call(this, payload, unblock));
    } else {
      return originMethod.call(this, payload, unblock);
    }
  };
}

{ // Hook responding to RPCs
  const origSend = MeteorX.Session.prototype.send;
  MeteorX.Session.prototype.send = function (payload: {
    msg: string;
    error?: unknown;
  }, ...x) {
    if (payload.msg == 'result') {
      const currentSpan = trace.getActiveSpan();
      if (currentSpan) {
        if (payload.error instanceof Meteor.Error) {
          currentSpan.setAttributes({
            'rpc.ddp.error': payload.error.error,
            'rpc.ddp.error_reason': payload.error.reason,
            'rpc.ddp.error_details': payload.error.details,
          });
          currentSpan.setStatus({
            code: SpanStatusCode.ERROR,
            message: payload.error.message,
          });
        } else if (payload.error instanceof Error) {
          currentSpan.recordException(payload.error);
          currentSpan.setStatus({
            code: SpanStatusCode.ERROR,
            message: payload.error.message,
          });
        } else if (payload.error?.message) {
          currentSpan.setStatus({
            code: SpanStatusCode.ERROR,
            message: payload.error.message,
          });
        }
        currentSpan.end();
      }
    }
    return origSend.call(this, payload, ...x);
  }
}
