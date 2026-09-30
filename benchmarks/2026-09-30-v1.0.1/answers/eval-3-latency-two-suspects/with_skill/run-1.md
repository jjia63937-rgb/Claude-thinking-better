**Not as your only move. Nothing so far points at the driver more than the middleware, and my guess is the middleware is the likelier cause.** Two things changed at once. If you roll back only the driver and it was the middleware, you lose a deploy cycle and you're still at 900ms. It's worth about 15 minutes of looking before you pick which change to revert.

**Why the middleware is at least as suspicious:** a middleware that writes to a remote service on every request puts that service's latency into your request path. That's especially true if it awaits the write, or flushes on the request thread and blocks the event loop. Remote calls are also a classic cause of tail latency: most calls are fast and a few are very slow, which fits a p99 jump better than a uniform slowdown. That's a strong reason to suspect it, but it's still a guess until you check.

**Checks that tell the two apart (fastest first):**

1. **Is the extra time inside DB calls or around them?** Look at your APM/tracing spans, or log query durations. If query time and pool wait time look the same as before the deploy, it isn't the driver.
2. **Did endpoints that don't hit Postgres slow down too?** Check health checks, cached routes and static routes. If they regressed as well, the driver can't be the cause. The middleware runs on every request.
3. **Turn the middleware off on one instance** (feature flag or env var) and compare its p99 with the others. This is the most direct test, and it's cheap and reversible.
4. **Look at the log service itself:** its response times, error or timeout rate, and whether your client retries. Also check event-loop lag on the API. If lag went up, something is blocking the loop, which points to synchronous logging or serialization.
5. **Compare p50 with p99.** A jump in p99 only, with p50 flat, fits intermittent slow remote calls or pool contention. A shift across the whole distribution fits a per-request cost.

**What would point to the driver:** query and pool spans got slower while non-DB endpoints stayed flat, or p99 stays at 900ms with the middleware off.

**If users are hurting right now:** roll back the *whole* deploy to the last known-good build, not just the driver. That restores service no matter which change is to blame. Then re-deploy the changes one at a time (middleware off with the new driver, or the reverse) to find the culprit. There's also a third possibility: something else in the same deploy, like a config, pool-size or env change, or a coincidental traffic shift. A full rollback covers that too.

**Confidence:** moderate that the middleware is the more likely cause, low that it's settled. The one fact that would change my view is the span breakdown in check 1. If the extra ~780ms is inside DB calls, your teammate is right.
