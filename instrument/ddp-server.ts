import { trace, propagation, ROOT_CONTEXT, SpanKind, SpanStatusCode, Span } from "@opentelemetry/api";
import { Meteor } from "meteor/meteor";

{ // Hook receiving rpcs from the client
  const {protocol_handlers} = MeteorX.Session.prototype;

  const methodtracer = trace.getTracer('ddp.method');
  const originMethod = protocol_handlers.method;
  protocol_handlers.method = function (payload, unblock) {
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
  };

  const subtracer = trace.getTracer('ddp.subscription');
  const origSub = protocol_handlers.sub;
  protocol_handlers.sub = function (payload, unblock) {
    const ctx = propagation.extract(ROOT_CONTEXT, payload.baggage ?? {}, {
      get(h,k) { return h[k]; },
      keys(h) { return Object.keys(h); },
    });

    this.subSpans ??= new Map();

    return subtracer.startActiveSpan(payload.name, {
      kind: SpanKind.SERVER,
      attributes: {
        'rpc.system': 'ddp-subscribe',
        'rpc.method': payload.name,
        'rpc.ddp.session': this.id,
        'rpc.ddp.version': this.version,
        'rpc.ddp.sub_id': payload.id,
        'meteor.user_id': this.userId,
        'net.peer.name': this.socket.remoteAddress,
        'net.peer.port': this.socket.remotePort,
        'net.host.name': this.socket.address.address,
        'net.host.port': this.socket.address.port,
        'net.sock.family': ({'IPv4':'inet','IPv6':'inet6'})[this.socket.address.family] ?? this.socket.address.family,
      },
    }, ctx, span => {
      this.subSpans.set(payload.id, span);
      // console.log('storing', payload.id)
      return origSub.call(this, payload, unblock);
    });
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
        recordSpanError(currentSpan, payload.error);
        currentSpan.end();
      }
    } else if (payload.msg == 'ready') {
      for (const subId of payload.subs) {
        const subSpan = this.subSpans?.get(subId);
        if (subSpan) {
          // console.log('sssub', subId, !!subSpan);
          subSpan.end();
          this.subSpans?.delete(subId);
        }
      }
    } else if (payload.msg == 'nosub') {
      const subId = payload.id;
      const subSpan = this.subSpans?.get(subId);
      if (subSpan) {
        // console.log('nosssub', subId, !!subSpan, payload.error);
        recordSpanError(subSpan, payload.error);
        subSpan.end();
        this.subSpans?.delete(subId);
      }
    }
    return origSend.call(this, payload, ...x);
  }
}

function recordSpanError(currentSpan: Span, error: unknown) {
  if (error instanceof Meteor.Error) {
    currentSpan.setAttributes({
      'rpc.ddp.error': error.error,
      'rpc.ddp.error_reason': error.reason,
      'rpc.ddp.error_details': error.details,
    });
    currentSpan.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
  } else if (error instanceof Error) {
    currentSpan.recordException(error);
    currentSpan.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
  } else if (error?.message) {
    currentSpan.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
  }
}
