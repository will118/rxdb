import config from './config';
import assert from 'assert';
import memdown from 'memdown';

let leveldb;
if (config.platform.isNode())
    leveldb = require('pouchdb-adapter-leveldb');

import * as RxDB from '../../dist/lib/index';
import * as util from '../../dist/lib/util';
import AsyncTestUtil from 'async-test-util';

describe('pouch-db-integration.test.js', () => {
    describe('init', () => {
        it('should export the pouchDB-module', async () => {
            assert.equal(typeof RxDB.PouchDB, 'function');
        });
    });
    describe('memdown', () => {
        it('should not allow leveldown-adapters without the plugin', async () => {
            await AsyncTestUtil.assertThrows(
                () => RxDB.create({
                    name: util.randomCouchString(10),
                    adapter: memdown
                }),
                Error
            );
        });
        it('should work after adding the leveldb-plugin', async () => {
            if (!config.platform.isNode()) return;
            RxDB.PouchDB.plugin(leveldb);
            const db = await RxDB.create({
                name: util.randomCouchString(10),
                adapter: memdown
            });
            assert.equal(db.constructor.name, 'RxDatabase');
            db.destroy();
        });
    });
    describe('pouchdb-adapter-memory', () => {
        it('should not create a db without adding the adapter', async () => {
            await AsyncTestUtil.assertThrows(
                () => RxDB.create({
                    name: util.randomCouchString(10),
                    adapter: 'memory'
                }),
                Error
            );
        });
        it('should work when adapter was added', async () => {
            RxDB.plugin(require('pouchdb-adapter-memory'));
            const db = await RxDB.create({
                name: util.randomCouchString(10),
                adapter: 'memory'
            });
            assert.equal(db.constructor.name, 'RxDatabase');
            db.destroy();
        });
    });
    describe('localstorage', () => {
        it('should crash because nodejs has no localstorage', async () => {
            if (!config.platform.isNode()) return;
            RxDB.PouchDB.plugin(require('pouchdb-adapter-localstorage'));
            await AsyncTestUtil.assertThrows(
                () => RxDB.create({
                    name: util.randomCouchString(10),
                    adapter: 'localstorage'
                }),
                Error
            );
        });
    });
    describe('websql', () => {
        describe('negative', () => {
            it('should fail when no adapter was added', async () => {
                await AsyncTestUtil.assertThrows(
                    () => RxDB.create({
                        name: util.randomCouchString(10),
                        adapter: 'websql'
                    }),
                    Error
                );
            });
        });
        describe('positive', () => {
            it('should work after adding the adapter', async () => {
                // test websql on chrome only
                if (config.platform.name !== 'chrome') return;

                RxDB.plugin(require('pouchdb-adapter-websql'));
                const db = await RxDB.create({
                    name: util.randomCouchString(10),
                    adapter: 'websql'
                });
                assert.equal(db.constructor.name, 'RxDatabase');
                await util.promiseWait(10);
                db.destroy();
            });
        });
    });
    describe('own pouchdb functions', () => {
        describe('.countAllUndeleted()', () => {
            it('should return 0', async () => {
                const name = util.randomCouchString(10);
                const pouchdb = new RxDB.PouchDB(
                    name, {
                        adapter: 'memory'
                    }
                );
                const count = await RxDB.PouchDB.countAllUndeleted(pouchdb);
                assert.deepEqual(count, 0);
            });
            it('should return 1', async () => {
                const name = util.randomCouchString(10);
                const pouchdb = new RxDB.PouchDB(
                    name, {
                        adapter: 'memory'
                    }
                );
                await pouchdb.put({
                    _id: util.randomCouchString(10)
                });
                const count = await RxDB.PouchDB.countAllUndeleted(pouchdb);
                assert.deepEqual(count, 1);
            });
            it('should not count deleted docs', async () => {
                const name = util.randomCouchString(10);
                const pouchdb = new RxDB.PouchDB(
                    name, {
                        adapter: 'memory'
                    }
                );
                const _id = util.randomCouchString(10);
                await pouchdb.put({
                    _id,
                    x: 1
                });

                const countBefore = await RxDB.PouchDB.countAllUndeleted(pouchdb);
                assert.deepEqual(countBefore, 1);

                const doc = await pouchdb.get(_id);
                await pouchdb.remove(doc);
                const count = await RxDB.PouchDB.countAllUndeleted(pouchdb);
                assert.deepEqual(count, 0);
            });
            it('should count a big amount with one deleted doc', async () => {
                const name = util.randomCouchString(10);
                const pouchdb = new RxDB.PouchDB(
                    name, {
                        adapter: 'memory'
                    }
                );

                const _id = util.randomCouchString(10);
                await pouchdb.put({
                    _id,
                    x: 1
                });
                const countBefore = await RxDB.PouchDB.countAllUndeleted(pouchdb);
                assert.deepEqual(countBefore, 1);
                const doc = await pouchdb.get(_id);
                await pouchdb.remove(doc);

                let t = 42;
                while (t > 0) {
                    await pouchdb.put({
                        _id: util.randomCouchString(10),
                        x: 1
                    });
                    t--;
                }
                const count = await RxDB.PouchDB.countAllUndeleted(pouchdb);
                assert.deepEqual(count, 42);
            });
        });
        describe('.getBatch()', () => {
            it('should return empty array', async () => {
                const name = util.randomCouchString(10);
                const pouchdb = new RxDB.PouchDB(
                    name, {
                        adapter: 'memory'
                    }
                );
                const docs = await RxDB.PouchDB.getBatch(pouchdb, 10);
                assert.deepEqual(docs, []);
            });
            it('should not return deleted', async () => {
                const name = util.randomCouchString(10);
                const pouchdb = new RxDB.PouchDB(
                    name, {
                        adapter: 'memory'
                    }
                );

                const _id = util.randomCouchString(10);
                await pouchdb.put({
                    _id,
                    x: 1
                });

                const countBefore = await RxDB.PouchDB.countAllUndeleted(pouchdb);
                assert.deepEqual(countBefore, 1);

                const doc = await pouchdb.get(_id);
                await pouchdb.remove(doc);

                const docs = await RxDB.PouchDB.getBatch(pouchdb, 10);
                assert.deepEqual(docs, []);
            });
            it('should return one document in array', async () => {
                const name = util.randomCouchString(10);
                const pouchdb = new RxDB.PouchDB(
                    name, {
                        adapter: 'memory'
                    }
                );
                const _id = util.randomCouchString(10);
                await pouchdb.put({
                    _id,
                    x: 1
                });
                const docs = await RxDB.PouchDB.getBatch(pouchdb, 10);
                assert.equal(docs.length, 1);
                assert.equal(docs[0].x, 1);
                assert.equal(docs[0]._id, _id);
            });

            it('should max return batchSize', async () => {
                const name = util.randomCouchString(10);
                const pouchdb = new RxDB.PouchDB(
                    name, {
                        adapter: 'memory'
                    }
                );

                let t = 42;
                while (t > 0) {
                    await pouchdb.put({
                        _id: util.randomCouchString(10),
                        x: 1
                    });
                    t--;
                }
                const batchSize = 13;
                const docs = await RxDB.PouchDB.getBatch(pouchdb, batchSize);
                assert.equal(docs.length, batchSize);
                docs.forEach(doc => {
                    assert.equal(doc.x, 1);
                });
            });
        });
    });
    describe('BUGS: pouchdb', () => {
        it('_local documents should not be cached by pouchdb', async () => {
            const name = util.randomCouchString(10);
            const _id = '_local/foobar';
            const createPouch = () => {
                return new RxDB.PouchDB(
                    name, {
                        adapter: 'memory'
                    }, {
                        auto_compaction: true,
                        revs_limit: 1
                    }
                );
            };
            const pouch1 = createPouch();
            const pouch2 = createPouch();
            await AsyncTestUtil.assertThrows(
                () => pouch2.get(_id),
                'PouchError'
            );
            // insert
            await pouch1.put({
                _id,
                value: 'foo'
            });
            const doc2 = await pouch2.get(_id);
            assert.equal(doc2.value, 'foo');

            pouch1.destroy();
            pouch2.destroy();
        });
        it('many inserts and removes should not create errors', async () => {
            const name = util.randomCouchString(10);
            const storage = {
                adapter: 'memory'
            };
            const createPouchInstance = async () => {
                const pouch = new RxDB.PouchDB(name, storage);
                await pouch.createIndex({
                    index: {
                        fields: ['updatedAt']
                    }
                });
                return pouch;
            };

            const pouch1 = await createPouchInstance();
            const pouch2 = await createPouchInstance();

            const generateDocData = () => {
                return {
                    _id: AsyncTestUtil.randomString(10),
                    bucket: 'foobar',
                    updatedAt: '2002-10-02T10:00:00-05:00'
                };
            };

            // generate some docs
            await Promise.all(
                new Array(100)
                .fill(0)
                .map(() => generateDocData())
                .map(data => pouch1.put(data))
            );

            const allDocsResult = await pouch1.find({
                selector: {}
            });
            const allDocs = allDocsResult.docs;

            const getResult = async () => {
                console.log('get result');
                const docsResult = await pouch2.find({
                    selector: {
                        bucket: {
                            $eq: 'foobar'
                        },
                        updatedAt: {
                            $gt: null
                        }
                    },
                    sort: ['updatedAt'],
                    limit: 8
                });
                const docs = docsResult.docs;
                console.log(docs.length);
            };

            await getResult();
            await Promise.all([
                allDocs.map(async (doc) => {
                    console.log('remove one');
                    await getResult();
                    await pouch1.remove(doc);
                })
            ]);

            await AsyncTestUtil.wait(500);

            process.exit();
        });
    });
});
