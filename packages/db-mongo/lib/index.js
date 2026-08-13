'use strict';

const { MongoClient } = require('mongodb');

/**
 * Generic MongoDB wrapper.
 *
 * Handles connection lifecycle (connect/close with dedupe), exposes the
 * underlying db handle, and provides small helpers (ping, listCollections).
 * Domain-specific queries belong in the consuming package, not here.
 */
class MongoDatabase {
  constructor(uri, options = {}) {
    this.uri = uri;
    this.dbName = options.dbName || 'default';
    this.poolSize = options.poolSize || 10;
    this.serverSelectionTimeoutMS = options.serverSelectionTimeoutMS || 5000;
    this._client = null;
    this._db = null;
    this._connecting = null;
  }

  /**
   * Connect (idempotent). Returns the db handle. Concurrent calls share one
   * connection attempt.
   */
  async connect() {
    if (this._db) return this._db;
    if (this._connecting) return this._connecting;

    this._connecting = (async () => {
      const client = new MongoClient(this.uri, {
        maxPoolSize: this.poolSize,
        serverSelectionTimeoutMS: this.serverSelectionTimeoutMS,
      });
      try {
        await client.connect();
        this._client = client;
        this._db = client.db(this.dbName);
        return this._db;
      } catch (err) {
        await client.close().catch(() => {});
        this._client = null;
        this._db = null;
        throw err;
      } finally {
        this._connecting = null;
      }
    })();

    return this._connecting;
  }

  /** Close the underlying client. Safe to call when not connected. */
  async close() {
    if (this._client) {
      const client = this._client;
      this._client = null;
      this._db = null;
      await client.close();
    }
  }

  /** The connected db handle (null until connect()). */
  get db() {
    return this._db;
  }

  /** Get a collection handle. Throws if not connected. */
  collection(name) {
    if (!this._db) {
      throw new Error('MongoDatabase: not connected. Call connect() first.');
    }
    return this._db.collection(name);
  }

  /** Ping the server. Returns true on success. */
  async ping() {
    const db = await this.connect();
    await db.command({ ping: 1 });
    return true;
  }

  /** List collection names in the database. */
  async listCollections() {
    const db = await this.connect();
    const list = await db.listCollections().toArray();
    return list.map((c) => c.name);
  }
}

/**
 * Minimal migration runner.
 *
 * Tracks applied migrations in a `migrations` collection ({name, appliedAt}).
 * `migrate()` applies unapplied migrations in order and records each one.
 */
class MigrationRunner {
  constructor(db, options = {}) {
    this.db = db; // MongoDatabase instance
    this.collectionName = options.collection || 'migrations';
  }

  async appliedNames() {
    const col = this.db.collection(this.collectionName);
    const docs = await col.find({}).toArray();
    return new Set(docs.map((d) => d.name));
  }

  /**
   * Apply migrations not yet recorded, in array order.
   * Each migration: { name, up(db) } where db is the MongoDatabase instance.
   * Returns a run report: array of { name, state } records with state one of
   * 'skipped' | 'running' | 'applied' | 'failed'. If a migration's up() throws,
   * migrate() rethrows the error with `err.results` set to the report so far.
   */
  async migrate(migrations) {
    const col = this.db.collection(this.collectionName);
    try {
      await col.createIndex({ name: 1 }, { unique: true });
    } catch (e) {
      // tolerate existing index (e.g. already created by a prior run)
    }
    const applied = await this.appliedNames();
    const results = [];
    for (const migration of migrations) {
      if (applied.has(migration.name)) {
        results.push({ name: migration.name, state: 'skipped' });
        continue;
      }
      const entry = { name: migration.name, state: 'running' };
      results.push(entry);
      try {
        await migration.up(this.db);
      } catch (err) {
        entry.state = 'failed';
        err.results = results;
        throw err;
      }
      try {
        await col.insertOne({ name: migration.name, appliedAt: new Date() });
      } catch (err) {
        if (err && err.code === 11000) {
          // applied by a concurrent migrate() call — up() already ran here
          applied.add(migration.name);
          entry.state = 'applied';
          continue;
        }
        throw err;
      }
      applied.add(migration.name);
      entry.state = 'applied';
    }
    return results;
  }
}

module.exports = { MongoDatabase, MigrationRunner };