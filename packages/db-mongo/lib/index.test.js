'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { mock } = require('node:test');
const { MongoClient } = require('mongodb');
const { MongoDatabase, MigrationRunner } = require('./index.js');

function fakeDb({ collections = [], commandResult = {} } = {}) {
  return {
    collection: (name) => ({
      find: () => ({ toArray: async () => [] }),
      insertOne: async () => ({}),
    }),
    command: async () => commandResult,
    listCollections: () => ({ toArray: async () => collections.map((name) => ({ name })) }),
  };
}

test('MongoDatabase.connect() connects and returns db handle', async () => {
  const db = fakeDb();
  mock.method(MongoClient.prototype, 'connect', async () => {});
  mock.method(MongoClient.prototype, 'db', () => db);
  mock.method(MongoClient.prototype, 'close', async () => {});

  const mdb = new MongoDatabase('mongodb://localhost:27017', { dbName: 'test' });
  const result = await mdb.connect();
  assert.strictEqual(result, db);
  assert.strictEqual(mdb.db, db);
  assert.strictEqual(MongoClient.prototype.connect.mock.calls.length, 1);
});

test('MongoDatabase.connect() dedupes concurrent calls', async () => {
  const db = fakeDb();
  mock.method(MongoClient.prototype, 'connect', async () => {});
  mock.method(MongoClient.prototype, 'db', () => db);
  mock.method(MongoClient.prototype, 'close', async () => {});

  const mdb = new MongoDatabase('mongodb://localhost:27017');
  const [a, b] = await Promise.all([mdb.connect(), mdb.connect()]);
  assert.strictEqual(a, db);
  assert.strictEqual(b, db);
  assert.strictEqual(MongoClient.prototype.connect.mock.calls.length, 1);
});

test('MongoDatabase.connect() cleans up client on failure', async () => {
  mock.method(MongoClient.prototype, 'connect', async () => {
    throw new Error('connection refused');
  });
  const closeMock = mock.method(MongoClient.prototype, 'close', async () => {});

  const mdb = new MongoDatabase('mongodb://localhost:27017');
  await assert.rejects(() => mdb.connect(), /connection refused/);
  assert.strictEqual(closeMock.mock.calls.length, 1);
  assert.strictEqual(mdb.db, null);
});

test('MongoDatabase.collection() throws before connect', () => {
  const mdb = new MongoDatabase('mongodb://localhost:27017');
  assert.throws(() => mdb.collection('x'), /not connected/);
});

test('MongoDatabase.collection() returns handle after connect', async () => {
  const db = fakeDb();
  mock.method(MongoClient.prototype, 'connect', async () => {});
  mock.method(MongoClient.prototype, 'db', () => db);
  mock.method(MongoClient.prototype, 'close', async () => {});

  const mdb = new MongoDatabase('mongodb://localhost:27017');
  await mdb.connect();
  const col = mdb.collection('candles');
  assert.ok(col);
  assert.strictEqual(typeof col.find, 'function');
});

test('MongoDatabase.ping() resolves true', async () => {
  const db = fakeDb();
  mock.method(MongoClient.prototype, 'connect', async () => {});
  mock.method(MongoClient.prototype, 'db', () => db);
  mock.method(MongoClient.prototype, 'close', async () => {});

  const mdb = new MongoDatabase('mongodb://localhost:27017');
  assert.strictEqual(await mdb.ping(), true);
});

test('MongoDatabase.listCollections() returns names', async () => {
  const db = fakeDb({ collections: ['a', 'b'] });
  mock.method(MongoClient.prototype, 'connect', async () => {});
  mock.method(MongoClient.prototype, 'db', () => db);
  mock.method(MongoClient.prototype, 'close', async () => {});

  const mdb = new MongoDatabase('mongodb://localhost:27017');
  assert.deepStrictEqual(await mdb.listCollections(), ['a', 'b']);
});

test('MongoDatabase.close() closes client and clears state', async () => {
  const db = fakeDb();
  mock.method(MongoClient.prototype, 'connect', async () => {});
  mock.method(MongoClient.prototype, 'db', () => db);
  const closeMock = mock.method(MongoClient.prototype, 'close', async () => {});

  const mdb = new MongoDatabase('mongodb://localhost:27017');
  await mdb.connect();
  await mdb.close();
  assert.strictEqual(closeMock.mock.calls.length, 1);
  assert.strictEqual(mdb.db, null);
  // close() again is a no-op
  await mdb.close();
  assert.strictEqual(closeMock.mock.calls.length, 1);
});

test('MigrationRunner.migrate() applies only unapplied migrations in order', async () => {
  const applied = new Set(['m1']);
  const inserted = [];
  const col = {
    createIndex: async () => {},
    find: () => ({ toArray: async () => [{ name: 'm1' }] }),
    insertOne: async (doc) => {
      inserted.push(doc);
    },
  };
  const db = { collection: () => col };
  const runner = new MigrationRunner(db);

  const upCalls = [];
  const migrations = [
    { name: 'm1', up: async () => upCalls.push('m1') },
    { name: 'm2', up: async () => upCalls.push('m2') },
    { name: 'm3', up: async () => upCalls.push('m3') },
  ];

  const appliedNow = await runner.migrate(migrations);
  assert.deepStrictEqual(appliedNow, [{ name: 'm1', state: 'skipped' }, { name: 'm2', state: 'applied' }, { name: 'm3', state: 'applied' }]);
  assert.deepStrictEqual(upCalls, ['m2', 'm3']);
  assert.strictEqual(inserted.length, 2);
  assert.strictEqual(inserted[0].name, 'm2');
  assert.ok(inserted[0].appliedAt instanceof Date);
  assert.strictEqual(applied.size, 1); // original set untouched
});

test('MigrationRunner.migrate() with no migrations returns []', async () => {
  const col = {
    createIndex: async () => {},
    find: () => ({ toArray: async () => [] }),
    insertOne: async () => ({}),
  };
  const db = { collection: () => col };
  const runner = new MigrationRunner(db);
  assert.deepStrictEqual(await runner.migrate([]), []);
});

test('MigrationRunner.migrate() skips concurrently-applied migration (duplicate key)', async () => {
  const col = {
    createIndex: async () => {},
    find: () => ({ toArray: async () => [{ name: 'm1' }] }),
    insertOne: async (doc) => {
      if (doc.name === 'm2') throw Object.assign(new Error('dup'), { code: 11000 });
    },
  };
  const db = { collection: () => col };
  const runner = new MigrationRunner(db);
  const upCalls = [];
  const migrations = [
    { name: 'm1', up: async () => upCalls.push('m1') },
    { name: 'm2', up: async () => upCalls.push('m2') },
    { name: 'm3', up: async () => upCalls.push('m3') },
  ];
  assert.deepStrictEqual(await runner.migrate(migrations), [{ name: 'm1', state: 'skipped' }, { name: 'm2', state: 'applied' }, { name: 'm3', state: 'applied' }]);
  assert.deepStrictEqual(upCalls, ['m2', 'm3']);
});

test('MigrationRunner.migrate() records failed state and rethrows with report', async () => {
  const col = {
    createIndex: async () => {},
    find: () => ({ toArray: async () => [] }),
    insertOne: async () => ({}),
  };
  const db = { collection: () => col };
  const runner = new MigrationRunner(db);
  const migrations = [
    { name: 'm1', up: async () => { throw new Error('boom'); } },
    { name: 'm2', up: async () => {} },
  ];
  await assert.rejects(
    () => runner.migrate(migrations),
    (err) => {
      assert.strictEqual(err.message, 'boom');
      assert.deepStrictEqual(err.results, [{ name: 'm1', state: 'failed' }]);
      return true;
    }
  );
});