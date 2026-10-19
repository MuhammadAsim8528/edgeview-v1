# Storage foundation and migration boundary

## Current scope

The active application still uses sql.js for operational data. This change does
not migrate customer data, replace V1 enrichment or switch the UI to another
database. `server/storage/raw_trade.ts` defines a separate raw-trade interface.
`sqlite_trade_warehouse.ts` is an executable disk-backed baseline candidate used
by tests and synthetic benchmarks, outside production startup.

The existing `DatabaseWrapper` in `server/sqlite.ts` is already the operational
storage abstraction. A future disk-backed driver should implement that boundary,
not introduce another competing operational store.

## Implemented query/streaming path

- Dataset identity plus source-row ordinal forms a stable compound primary key.
  Callers must derive dataset identity from an immutable source fingerprint.
- Each row retains its complete source-field object; projected company/country/
  date/product columns support queries without reading every raw payload.
- Ingestion uses transactions with a checkpoint in the same commit. Failed batches
  roll back; completed batches remain resumable. Repeated identical rows deduplicate;
  a changed row under the same identity raises an error.
- Input batches are bounded to 500 rows and about 4 MiB serialized input, with a
  1 MiB row cap. Reads use keyset pagination capped at 1,000 rows. Export iterates
  pages of 500. No whole-dataset JavaScript array is required by this interface.
- Bound parameters protect filter values; projection columns use an allowlist.
  Country/company indexes and date/product predicates execute in storage.
- WAL with FULL synchronous mode provides disk-backed transaction persistence.
  This does not claim survival against faulty hardware or every power-loss case.

## Candidate assessment

Node's built-in SQLite is available on the tested Windows Node v24.19.0 runtime
without installing a native package. Its DatabaseSync interface is synchronous:
UI integration requires a dedicated worker/process with bounded messages. Async
iteration between batches does not make individual SQL operations asynchronous.
The API is a release candidate in this runtime, and experimental on Node 22.
See [Node v24.19.0 SQLite documentation](https://nodejs.org/download/release/v24.19.0/docs/api/sqlite.html).

DuckDB's supported Node Neo client is a separate native dependency; the older
Node client is deprecated. DuckDB/partitioned Parquet remains an analytical
candidate for columnar scans and aggregation. It has not been installed or
benchmarked here, so this work does not select a final warehouse engine or claim
columnar statistics, Parquet partition pruning or Panjiva-scale operation.
See [DuckDB Node client](https://duckdb.org/docs/stable/clients/node_neo/overview)
and [deprecated client notice](https://duckdb.org/docs/lts/clients/nodejs/overview).

## Benchmark method

Run separately in fresh processes:

    node --import tsx scripts/benchmark-trade-warehouse.ts 100000
    node --import tsx scripts/benchmark-trade-warehouse.ts 1000000

The benchmark permits only these two sizes, checks 2 GiB free space at startup,
uses synthetic rows in a unique temporary folder, and removes that folder after
closing the candidate database. It reads no customer dataset, credentials or
evidence. It reports process peak RSS, ingest duration, one warm filtered query,
store bytes including WAL, and streamed serialization throughput. The export sink
counts bytes without writing a second large file, so it is not disk-export speed.
Repeated runs, cold-cache latency, concurrent workloads and disk-export measurement
remain necessary for engine selection.

Measured on this laptop on 2026-10-19, Windows, Node v24.19.0 (one fresh process per size):

| Synthetic rows | Persisted rows | Ingest | Warm filtered query | Peak RSS | Store bytes including WAL | Stream/serialize |
|---|---|---|---|---|---|---|
| 100,000 | 100,000 | 35.850 s | 46.394 ms (10 rows) | 105.508 MiB | 42,664,152 | 0.780 s; 128,190 rows/s |
| 1,000,000 | 1,000,000 | 367.083 s | 394.521 ms (100 rows) | 106.719 MiB | 377,775,224 | 6.408 s; 156,048 rows/s |

The temporary stores were closed and removed after measurement. The million-row
run was monitored during ingestion; free space stayed above 3 GB. Memory stayed
bounded in these fixtures, but ingest latency and filtered-query growth still need
comparison and tuning. These results do not measure the live app or claim hardware
minimums, a complete warehouse migration, or unlimited scale.

## Migration steps still required

1. Benchmark DuckDB/Parquet and a compatible disk-backed transactional driver on
   representative data; compare packaging and recovery on the supported Windows runtimes.
2. Put synchronous candidate drivers behind a worker with backpressure and cancellation.
3. Add streaming parser adapters which assign source fingerprints and stable ordinals;
   replace UI full-row loads with query pages only after end-to-end parity tests.
4. Add aggregation/partition APIs and benchmark broad product/date scans, export
   backpressure and interrupted import recovery across process termination.
5. Migrate operational data into a new file from a stopped, verified backup. Compare
   schema versions, row counts, content hashes and job checkpoints before switching.
   Preserve the old database and rollback pointer until acceptance testing passes.
6. Keep immutable V1 evidence separate; hydrate legacy JSON and versioned blobs
   through the existing evidence adapter. Do not rewrite historical captures in place.

Existing large uploads still use the current parsing path; this foundation does
not make the current browser import path suitable for millions of rows.
