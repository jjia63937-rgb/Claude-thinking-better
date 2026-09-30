Not yet. Right now you have two suspects and no evidence pointing at either one. If I had to bet, I'd bet on the logging middleware over the driver.

**Why the middleware is the stronger suspect**
- A middleware that writes to a remote service on every request puts a network round trip into the request path. If that write is awaited, or if it blocks because a buffer or connection pool is full, every request pays for it. When the log service is slow, you get exactly this pattern: the median barely moves and the tail blows up.
- A jump from ~120ms to ~900ms looks like waiting on something: timeouts, retries, backpressure, or connection queuing. It doesn't look like a driver doing a bit more CPU work.
- pg 8.7 to 8.11 is a minor-version bump within the same major version. A regression is possible (changes to pool behavior, SSL/connection setup defaults, or pg-types parsing), but a 7x p99 regression from a minor bump would be unusual.

**How to tell which one it is (in minutes, not a rollback cycle)**
1. **Check your traces or APM.** Split request time into DB query spans and everything else. If query and pool-acquire times are unchanged and the extra ~780ms sits outside the DB calls, it's not the driver.
2. **Time the middleware directly.** Look at the log service's response latency, error and timeout rates, and whether the middleware `await`s the send. Also check whether it opens a new connection per request (no keep-alive) or retries synchronously.
3. **Check the DB side.** Look at `pg_stat_activity`, pool waiting-client counts and query durations. Driver or pool problems show up here as time spent waiting to acquire a connection or as slower queries.
4. **Turn the middleware off with a flag or config, if you can.** This is the cheapest, fastest and most reversible test. If p99 drops back to ~120ms, you have your answer without touching the driver.

**What I'd actually do**
- If this is hurting users right now and you can't diagnose quickly, roll back *both* changes (or the whole deploy) to stop the bleeding. Then reintroduce them one at a time. Rolling back only the driver on a hunch risks leaving the real cause in place and losing another night.
- Otherwise, disable the logging middleware first. It's the likelier cause and the easier toggle. If latency recovers, fix it by making log shipping async and non-blocking: buffer the entries, batch them, and send them in the background with a bounded queue that drops entries when full and a short timeout. Keep the pg upgrade.
- If disabling the middleware doesn't help, then roll back the driver and compare.

In short, don't roll back the driver just because your teammate is sure. Measure first, or roll back both. Going by the evidence you have, the new synchronous remote call on every request is the more likely cause.
