import { trace, SpanKind, context } from "@opentelemetry/api";
import { suppressTracing } from "@opentelemetry/core";
import { Mongo } from "meteor/mongo";
import {
  DbSystemValues,
  SemanticAttributes,
} from '@opentelemetry/semantic-conventions';
import { settings } from "../settings";

const tracer = trace.getTracer('meteor.mongo');

MeteorX.onReady(() => {
  const x1 = MeteorX.MongoCursor.prototype as InstanceType< typeof Mongo.Cursor>;
  // cursors have _cursorDescription: {collectionName, selector, options}
  const origFind = x1.fetch;
  x1.fetch = function (this: Mongo.Cursor<{}>, ...args) {
    const ids = cursorIds(this);
    if (ignored(ids)) return origFind.apply(this, args);
    return tracer.startActiveSpan(`find.fetch ${ids.collectionName}`,
      mongoSpanOptions(ids, 'find.fetch'),
      span => {
        try {
          const resp = origFind.apply(this, args);
          span.setAttribute('db.mongodb.documents_returned', resp.length);
          return resp;
        } finally {
          span.end();
      }
    });
  }
  const origCount = x1.count;
  x1.count = function (this: Mongo.Cursor<{}>, ...args) {
    const ids = cursorIds(this);
    if (ignored(ids)) return origCount.apply(this, args);
    return tracer.startActiveSpan(`find.count ${ids.collectionName}`,
      mongoSpanOptions(ids, 'find.count'),
      span => {
        try {
          const result = origCount.apply(this, args)
          span.setAttribute('db.mongodb.documents_returned', result);
          return result;
        } finally {
          span.end();
        }
      });
  }
  const origForEach = x1.forEach;
  x1.forEach = function (this: Mongo.Cursor<{}>, ...args) {
    const ids = cursorIds(this);
    if (ignored(ids)) return origForEach.apply(this, args);
    return tracer.startActiveSpan(`find.forEach ${ids.collectionName}`,
      mongoSpanOptions(ids, 'find.forEach'),
      span => {
        try {
          return origForEach.apply(this, args)
        } finally {
          span.end();
        }
      });
  }
  const origMap = x1.map;
  x1.map = function (this: Mongo.Cursor<{}>, ...args) {
    const ids = cursorIds(this);
    if (ignored(ids)) return origMap.apply(this, args);
    return tracer.startActiveSpan(`find.map ${ids.collectionName}`,
      mongoSpanOptions(ids, 'find.map'),
      span => {
        try {
          return origMap.apply(this, args)
        } finally {
          span.end();
        }
      });
  }
});

const x2 = Mongo.Collection.prototype as InstanceType< typeof Mongo.Collection>;
const origFindOne = x2.findOne;
x2.findOne = function (this: Mongo.Collection<{}>, ...args) {
  const ids = collIds(this, args[0]);
  if (ignored(ids)) return origFindOne.apply(this, args);
  return tracer.startActiveSpan(`findOne ${ids.collectionName}`,
    mongoSpanOptions(ids, 'findOne'),
    span => {
      try {
        const ctx = suppressTracing(context.active());
        return context.with(ctx, () => origFindOne.apply(this, args));
      } finally {
        span.end();
      }
    });
}
const origCreateIndex = x2.createIndex;
x2.createIndex = function (this: Mongo.Collection<{}>, ...args) {
  const ids = collIds(this, args[0]);
  if (ignored(ids)) return origCreateIndex.apply(this, args);
  return tracer.startActiveSpan(`createIndex ${ids.collectionName}`,
    mongoSpanOptions(ids, 'createIndex'),
    span => {
      try {
        return origCreateIndex.apply(this, args)
      } finally {
        span.end();
      }
    });
}
const origInsert = x2.insert;
x2.insert = function (this: Mongo.Collection<{}>, ...args) {
  const ids = collIds(this, args[0]);
  if (ignored(ids)) return origInsert.apply(this, args);
  return tracer.startActiveSpan(`insert ${ids.collectionName}`,
    mongoSpanOptions(ids, 'insert'),
    span => {
      try {
        return origInsert.apply(this, args)
      } finally {
        span.end();
      }
    });
}
const origRemove = x2.remove;
x2.remove = function (this: Mongo.Collection<{}>, ...args) {
  const ids = collIds(this, args[0]);
  if (ignored(ids)) return origRemove.apply(this, args);
  return tracer.startActiveSpan(`remove ${ids.collectionName}`,
    mongoSpanOptions(ids, 'remove'),
    span => {
      try {
        const result = origRemove.apply(this, args)
        span.setAttribute('db.mongodb.documents_affected', result.numberAffected);
        return result;
      } finally {
        span.end();
      }
    });
}
const origUpdate = x2.update;
x2.update = function (this: Mongo.Collection<{}>, ...args) {
  const ids = collIds(this, args[0]);
  if (ignored(ids)) return origUpdate.apply(this, args);
  return tracer.startActiveSpan(`update ${ids.collectionName}`,
    mongoSpanOptions(ids, 'update'),
    span => {
      try {
        const result = origUpdate.apply(this, args)
        span.setAttribute('db.mongodb.documents_affected', result.numberAffected);
        return result;
      } finally {
        span.end();
    }
  });
}
const origUpsert = x2.upsert;
x2.upsert = function (this: Mongo.Collection<{}>, ...args) {
  const ids = collIds(this, args[0]);
  if (ignored(ids)) return origUpsert.apply(this, args);
  return tracer.startActiveSpan(`upsert ${ids.collectionName}`,
    mongoSpanOptions(ids, 'upsert'),
    span => {
      try {
        const ctx = suppressTracing(context.active());
        return context.with(ctx, () => origUpsert.apply(this, args));
      } finally {
        span.end();
      }
    });
}


function mongoSpanOptions(ids: ReturnType<typeof collIds>, operation: string) {
  // console.error({db: cursor._mongo.db.databaseName});
  return {
    kind: SpanKind.CLIENT,
    attributes: {
      [SemanticAttributes.DB_SYSTEM]: DbSystemValues.MONGODB,
      [SemanticAttributes.DB_NAME]: ids.databaseName ?? undefined,
      [SemanticAttributes.DB_MONGODB_COLLECTION]: ids.collectionName ?? undefined,
      [SemanticAttributes.DB_OPERATION]: operation,
      [SemanticAttributes.DB_STATEMENT]: JSON.stringify(ids.query),
    }
  };
}

function ignored(ids: ReturnType<typeof collIds>) {
  if (!ids.collectionName) return true;
  if (ids.collectionName.startsWith('__dummy_coll_')) return true;
  if (ids.databaseName == 'local' && ids.collectionName == 'oplog.rs') return true;
  return false;
}

function collIds(coll: Mongo.Collection<{}>, filter: {}) {
  if (coll._name == null) {
    return {
      databaseName: null,
      collectionName: null,
      query: _defaultDbStatementSerializer(filter) ?? {},
    };
  }
  return {
    databaseName: coll._driver.mongo?.db.databaseName as string,
    collectionName: coll._name as string,
    query: _defaultDbStatementSerializer(filter) ?? {},
  };
}
function cursorIds(cursor: Mongo.Cursor<{}>) {
  if (!cursor._cursorDescription.collectionName) {
    return {
      databaseName: null,
      collectionName: null,
      query: _defaultDbStatementSerializer(cursor._cursorDescription.selector),
    };
  }
  return {
    databaseName: cursor._mongo.db.databaseName as string,
    collectionName: cursor._cursorDescription.collectionName as string,
    query: _defaultDbStatementSerializer(cursor._cursorDescription.selector),
  };
}


// It is possible to get instrumentation from mongodb driver, but the Meteor context seems long gone...

// const client = MongoInternals.defaultRemoteCollectionDriver().mongo.client;
// // contextManager.bind()
// client.on('commandStarted', evt => {
//   console.error('commandStarted', evt.commandName);
//   console.error(trace.getActiveSpan()?.isRecording())
//   console.error('fiber', Fiber.current)
//   // console.error(new Error().stack)
// })



// const mcnof_op = Npm.require('../node_modules/meteor/npm-mongo/node_modules/mongodb/lib/operations.js')
// console.log({mcnof_op})

// const mcnof_pool = Npm.require('../node_modules/meteor/npm-mongo/node_modules/mongodb/lib/cmap/connection_pool.js')
// const checkOOO = mcnof_pool.ConnectionPool.prototype.checkOut;
// mcnof_pool.ConnectionPool.prototype.checkOut = function (cb) {
//   const ctx = context.active();
//   console.log('checkout', trace.getSpan(ctx)?.isRecording());
//   checkOOO.call(this, (...args) => context.with(ctx, () => cb(...args)));
// }

// const mcnofg = Npm.require('../node_modules/meteor/npm-mongo/node_modules/mongodb/lib/cmap/connection.js')
// const ins = new MongoDBInstrumentation();
// ins.init()[1].files[0].patch(mcnofg);
// const orig = mcnofg.Connection.prototype.command;
// mcnofg.Connection.prototype.command = function (...args) {
//   console.error(args[0].collection, trace.getActiveSpan()?.isRecording());
//   if (args[0].collection == 'Profiles') console.log(new Error().stack)
//   return orig.apply(this, args);
// }




// const origOpen = MongoInternals.defaultRemoteCollectionDriver().open;
// MongoInternals.defaultRemoteCollectionDriver().mongo.client.withSession(x => x.).open = (name, conn) => {
//   console.log('open', name);
//   const coll = origOpen.call(MongoInternals.defaultRemoteCollectionDriver(), name, conn);
//   return new Proxy(coll, {
//     // apply(real, self, args) {
//     //   console.log(args);
//     //   return
//     // }
//     get(target, key) {
//       console.log('get', key);
//       return target[key];
//     }
//   })
// }


function _defaultDbStatementSerializer(commandObj: string | Record<string, unknown>, isRoot=true) {
  const { enhancedDbReporting } = settings;
  if (typeof commandObj == 'string' && isRoot) return { _id: '?' };
  if (enhancedDbReporting) return commandObj; // pretty leaky tbh

  if (typeof commandObj == 'object' && commandObj.constructor == Object) {
    // rewrite the object
    return Object.fromEntries(Object.entries(commandObj).map(([key,val]) => {
      if (key.startsWith('$')) {
        if (Array.isArray(val)) {
          return [key, val.map(x => _defaultDbStatementSerializer(x, false))];
        }
        return [key, _defaultDbStatementSerializer(val, false)];
      }
      // if val is object and all keys start with '$' then convert that too
      if (val && typeof val == 'object' && Object.keys(val).every(x => x.startsWith('$'))) {
        return [key, _defaultDbStatementSerializer(val, false)];
      }
      return [key, '?'];
    }));
  }
  return '?';
}
