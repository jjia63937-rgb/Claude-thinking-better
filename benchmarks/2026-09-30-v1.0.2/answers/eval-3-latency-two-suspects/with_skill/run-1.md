**Not the driver on its own, at least not yet.** Nothing you've described points to the driver over the middleware. Both changed in the same deploy, so the timing fits either one equally well. If I had to bet, I'd bet on the new logging middleware. But the evidence to tell them apart is cheap to get, so check before you pick one.

**If p99 is hurting users right now:** roll back the *whole* deploy (driver and middleware), not just the driver. That restores the known-good state no matter which change caused it. Then add the two changes back one at a time. If you roll back only the driver and the middleware is the cause, you'll have reverted a harmless upgrade and still have 900ms.

**Why I lean toward the middleware:** a middleware that writes to a remote service on each request can add a network round-trip to every request. If the write is awaited before the response, or it shares the event loop or a connection pool that backs up, that shows up in exactly one place: the tail. The remote service's own slow requests (retries, timeouts, DNS, TLS setup) become *your* p99. A minor driver bump can cause regressions too, but it isn't the more likely explanation by default. This is a prior, not a finding.

**The observations that decide it (fastest first):**

1. **Where is the extra time?** In your traces or APM, compare the time spent in pg query spans before and after the deploy against total request time.
   - DB time went up → driver (or pool behavior) is the suspect.
   - DB time is flat and the gap is outside queries → middleware.
2. **Turn off the middleware on one instance** (via a flag or config, no redeploy if you can) and compare its p99 with the other instances for 15–30 minutes. This is the most direct test.
3. **Check how the logger sends.** Does it `await` the remote call in the request path? Does it flush synchronously, or have no timeout? Also look at the log service's own latency and error rate since last night.
4. **Look at the shape of the regression.** Did p50 barely move while p99 exploded? That suggests intermittent stalls, like remote calls timing out or pool waits, more than a uniform per-query slowdown. Check pg pool wait time and event-loop lag too.
5. Also rule out anything else that shipped or changed last night: other config, dependency bumps in the lockfile, a traffic change.

**If it is the middleware,** the usual fix is to make logging fire-and-forget with a local buffer, batching and a short timeout, so the log service can never block a response.

**What would change my answer:** if trace data shows the added time sitting inside pg query spans, your teammate is right and rolling back the driver is the right call. Until you see that, "it's the driver" is a guess, and one data point from step 1 or 2 will settle it.
