import { trace, SpanKind, context } from "@opentelemetry/api";
import { suppressTracing } from "@opentelemetry/core";
import { Mongo } from "meteor/mongo";
import {
  DBSYSTEMVALUES_MONGODB,
  SEMATTRS_DB_SYSTEM,
  SEMATTRS_DB_NAME,
  SEMATTRS_DB_MONGODB_COLLECTION,
  SEMATTRS_DB_OPERATION,
  SEMATTRS_DB_STATEMENT,
} from '@opentelemetry/semantic-conventions';
import { settings } from "../settings";

const tracer = trace.getTracer('meteor.mongo');

MeteorX.onReady(() => {
  const x1 = MeteorX.MongoCursor.prototype as InstanceType< typeof Mongo.Cursor>;
  // cursors have _cursorDescription: {collectionName, selector, options}
  const origFind = x1.fetchAsync;
  x1.fetchAsync = function (this: Mongo.Cursor<{}>, ...args) {
    const ids = cursorIds(this);
    if (ignored(ids)) return origFind.apply(this, args);
    return tracer.startActiveSpan(`find.fetch ${ids.collectionName}`,
      mongoSpanOptions(ids, 'find.fetch'),
      async span => {
        try {
          const resp = await origFind.apply(this, args);
          span.setAttribute('db.mongodb.documents_returned', resp.length);
          return resp;
        } finally {
          span.end();
      }
    });
  }
  const origCount = x1.countAsync;
  x1.countAsync = function (this: Mongo.Cursor<{}>, ...args) {
    const ids = cursorIds(this);
    if (ignored(ids)) return origCount.apply(this, args);
    return tracer.startActiveSpan(`find.count ${ids.collectionName}`,
      mongoSpanOptions(ids, 'find.count'),
      async span => {
        try {
          const result = await origCount.apply(this, args)
          span.setAttribute('db.mongodb.documents_returned', result);
          return result;
        } finally {
          span.end();
        }
      });
  }
  const origForEach = x1.forEachAsync;
  x1.forEachAsync = function (this: Mongo.Cursor<{}>, ...args) {
    const ids = cursorIds(this);
    if (ignored(ids)) return origForEach.apply(this, args);
    return tracer.startActiveSpan(`find.forEach ${ids.collectionName}`,
      mongoSpanOptions(ids, 'find.forEach'),
      async span => {
        try {
          return await origForEach.apply(this, args);
        } finally {
          span.end();
        }
      });
  }
  const origMap = x1.mapAsync;
  x1.mapAsync = async function <M>(this: Mongo.Cursor<{}>, ...args) {
    const ids = cursorIds(this);
    if (ignored(ids)) return await origMap.apply(this, args) as M[];
    return await tracer.startActiveSpan(`find.map ${ids.collectionName}`,
      mongoSpanOptions(ids, 'find.map'),
      async span => {
        try {
          return await origMap.apply(this, args) as M[];
        } finally {
          span.end();
        }
      });
  }
});

const x2 = Mongo.Collection.prototype as InstanceType< typeof Mongo.Collection>;
const origFindOne = x2.findOneAsync;
x2.findOneAsync = function (this: Mongo.Collection<{}>, ...args: [string]) {
  const ids = collIds(this, args[0]);
  if (ignored(ids)) return origFindOne.apply(this, args);
  return tracer.startActiveSpan(`findOne ${ids.collectionName}`,
    mongoSpanOptions(ids, 'findOne'),
    async span => {
      try {
        const ctx = suppressTracing(context.active());
        return await context.with(ctx, () => origFindOne.apply(this, args));
      } finally {
        span.end();
      }
    });
}
const origCreateIndex = x2.createIndexAsync;
x2.createIndexAsync = function (this: Mongo.Collection<{}>, ...args) {
  const ids = collIds(this, args[0]);
  if (ignored(ids)) return origCreateIndex.apply(this, args);
  return tracer.startActiveSpan(`createIndex ${ids.collectionName}`,
    mongoSpanOptions(ids, 'createIndex'),
    async span => {
      try {
        return await origCreateIndex.apply(this, args)
      } finally {
        span.end();
      }
    });
}
const origInsert = x2.insertAsync;
x2.insertAsync = function (this: Mongo.Collection<{}>, ...args) {
  const ids = collIds(this, args[0]);
  if (ignored(ids)) return origInsert.apply(this, args);
  return tracer.startActiveSpan(`insert ${ids.collectionName}`,
    mongoSpanOptions(ids, 'insert'),
    async span => {
      try {
        return await origInsert.apply(this, args)
      } finally {
        span.end();
      }
    });
}
const origRemove = x2.removeAsync;
x2.removeAsync = function (this: Mongo.Collection<{}>, ...args) {
  const ids = collIds(this, args[0]);
  if (ignored(ids)) return origRemove.apply(this, args);
  return tracer.startActiveSpan(`remove ${ids.collectionName}`,
    mongoSpanOptions(ids, 'remove'),
    async span => {
      try {
        const result = await origRemove.apply(this, args)
        span.setAttribute('db.mongodb.documents_affected', result);
        return result;
      } finally {
        span.end();
      }
    });
}
const origUpdate = x2.updateAsync;
x2.updateAsync = function (this: Mongo.Collection<{}>, ...args) {
  const ids = collIds(this, args[0]);
  if (ignored(ids)) return origUpdate.apply(this, args);
  return tracer.startActiveSpan(`update ${ids.collectionName}`,
    mongoSpanOptions(ids, 'update'),
    async span => {
      try {
        const result = await origUpdate.apply(this, args)
        span.setAttribute('db.mongodb.documents_affected', result);
        return result;
      } finally {
        span.end();
    }
  });
}
const origUpsert = x2.upsertAsync;
x2.upsertAsync = function (this: Mongo.Collection<{}>, ...args) {
  const ids = collIds(this, args[0]);
  if (ignored(ids)) return origUpsert.apply(this, args);
  return tracer.startActiveSpan(`upsert ${ids.collectionName}`,
    mongoSpanOptions(ids, 'upsert'),
    async span => {
      try {
        const ctx = suppressTracing(context.active());
        return await context.with(ctx, () => origUpsert.apply(this, args));
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
      [SEMATTRS_DB_SYSTEM]: DBSYSTEMVALUES_MONGODB,
      [SEMATTRS_DB_NAME]: ids.databaseName ?? undefined,
      [SEMATTRS_DB_MONGODB_COLLECTION]: ids.collectionName ?? undefined,
      [SEMATTRS_DB_OPERATION]: operation,
      [SEMATTRS_DB_STATEMENT]: JSON.stringify(ids.query),
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
