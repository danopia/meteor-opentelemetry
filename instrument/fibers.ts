import { metrics, trace, context } from '@opentelemetry/api';
// import type FiberType from 'fibers';
// let Fibers: typeof FiberType = Npm.require('fibers');
import Fibers from 'fibers';
let StartTracked = Symbol('MontiStartTracked');

// Two instrumentations of fibers:
// 1. metrics about how fibers are doing
// 2. spans for fiber suspensions - commented out due to low value

let wrapped = false;

export function wrapFibers () {
  if (wrapped) {
    return;
  }
  wrapped = true;

  // Let's report some metrics
  const metric = metrics.getMeter('meteor.fibers');

  // When metrics are gathered, give the latest tallies
  metric.createObservableCounter('meteor.fibers.num_created')
    .addCallback(x => x.observe(Fibers.fibersCreated));
  metric.createObservableGauge('meteor.fibers.pool_size')
    .addCallback(x => x.observe(Fibers.poolSize));

  // Also emit counters live in our hijacks
  const activeFibers = metric.createUpDownCounter('meteor.fibers.currently_active');
  const fiberInvokes = metric.createCounter('meteor.fibers.num_starts');
  const fiberYields = metric.createCounter('meteor.fibers.num_yields');

  // We can also trace when fibers suspend... but the value seems low
  // const spans = new WeakMap<Fibers,Span>();
  // const tracer = trace.getTracer('fiberyield');
  // function endAsyncEvent (fiber: InstanceType<typeof FiberType>) {
  //   const asyncSpan = spans.get(fiber);
  //   if (asyncSpan) {
  //     console.log("Ending fiber span")
  //     spans.delete(fiber);
  //     asyncSpan.end();
  //   }
  // }

  let originalYield = Fibers.yield;
  Fibers.yield = function () {
    fiberYields.add(1);

    // const activeSpan = trace.getActiveSpan();
    // if (activeSpan) {
    //   console.log('Starting fiber span');
    //   const asyncSpan = tracer.startSpan('async_op');
    //   spans.set(Fibers.current, asyncSpan);
    //   return context.with(trace.setSpan(context.active(), asyncSpan), originalYield);
    // }

    return originalYield();
  };

  let originalRun = Fibers.prototype.run;
  let originalThrowInto = Fibers.prototype.throwInto;

  function ensureFiberCounted (fiber: Fibers) {
    // If fiber.started is true, and StartTracked is false
    // then the fiber was probably initially ran before we wrapped Fibers.run
    if (!fiber.started || !fiber[StartTracked]) {
      activeFibers.add(1);
      fiberInvokes.add(1);
      fiber[StartTracked] = true;
    }
  }

  Fibers.prototype.run = function (val) {
    ensureFiberCounted(this);
    // endAsyncEvent(this);

    // TODO: consider copying our env from 'Fibers.current' into 'this'

    let result;
    try {
      result = originalRun.call(this, val);
    } finally {
      // console.log('fiber end')
      if (!this.started) {
        // This fiber has been returned to the cold pool
        activeFibers.add(-1);
        this[StartTracked] = false;
      }
    }

    return result;
  };

  Fibers.prototype.throwInto = function (val) {
    ensureFiberCounted(this);
    // endAsyncEvent(this);

    let result;
    console.log("fiber throwinto", val.message)

    try {
      result = originalThrowInto.call(this, val);
    } finally {
      if (!this.started) {
        activeFibers.add(-1);
        this[StartTracked] = false;
      }
    }

    return result;
  };
}
