import { Context, ContextManager, ROOT_CONTEXT } from '@opentelemetry/api';
import { Meteor } from 'meteor/meteor';

import Fiber from 'fibers';

export class MeteorContextManager implements ContextManager {
  envVar: Meteor.EnvironmentVariable<Context>;
  constructor() {
    this.envVar = new Meteor.EnvironmentVariable<Context>();
  }

  rootWith?: <A extends unknown[], F extends (...args: A) => ReturnType<F>>(context: Context, fn: F, thisArg?: ThisParameterType<F> | undefined, ...args: A) => ReturnType<F>;
  rootBind?: <T>(context: Context, target: T) => T;

  active(): Context {
    if (!Fiber.current) return ROOT_CONTEXT;
    return this.envVar.getOrNullIfOutsideFiber() ?? ROOT_CONTEXT;
  }
  with<A extends unknown[], F extends (...args: A) => ReturnType<F>>(context: Context, fn: F, thisArg?: ThisParameterType<F> | undefined, ...args: A): ReturnType<F> {
    if (!Fiber.current) {
      return this.rootWith!(context, fn, thisArg);
      // return Meteor.bindEnvironment(() => this.with(context, fn, thisArg, ...args))();
      // return fn.apply(thisArg, args);
    }
    return this.envVar.withValue(context, (thisArg || args.length) ? fn.bind(thisArg, ...args) : fn);
  }
  bind<T>(context: Context, target: T): T {
    if (!Fiber.current) {
      return this.rootBind!(context, target);
      // return Meteor.bindEnvironment(() => this.with(context, fn, thisArg, ...args))();
      // return fn.apply(thisArg, args);
    }
    // if (target instanceof EventEmitter) {
    //   // throw new Error(`TODO: bind of EventEmitter`);
    //   return this._bindEventEmitter(context, target);
    // }
    if (typeof target === 'function') {
      // Seems like the easiest way to grab a specific new context for later calling
      return this.envVar.withValue(context, () => Meteor.bindEnvironment(target));
    }
    return target;
  }

  // Meteor's context manager is always active - we don't control the lifecycle
  enable(): this {
    this.rootBind = Meteor.bindEnvironment(this.bind.bind(this));
    this.rootWith = Meteor.bindEnvironment(this.with.bind(this));
    return this;
    // throw new Error('Method not implemented.');
  }
  disable(): this {
    return this;
    // throw new Error('Method not implemented.');
  }

}
