**Not the driver on its own, at least not yet. If you need relief now, roll back the whole deploy. If you can spend 15–30 minutes first, run one check that tells the two suspects apart before you pick one.**

Nothing so far points at the driver more than at the middleware. Both changes went out together, so the timing fits either one equally well. If anything, a middleware that calls a remote service on each request is the more common cause of a jump like this in the tail. Going from ~120ms to ~900ms at p99 is what you'd expect when some requests wait on a slow or rate-limited log endpoint: the logging call is awaited in the request path, retries or timeouts pile up, or a large payload gets serialized and blocks the event loop. Rolling back only the driver could waste a deploy cycle while users still see 900ms.

**Candidates, and what would separate them:**

| Hypothesis | What you'd see if it's true |
|---|---|
| Logging middleware (remote call in the request path, or event-loop blocking) | The extra time is *outside* DB spans in traces/APM. Event-loop lag goes up. Latency drops when the middleware is off. The log service's own response times look slow or spiky. |
| pg driver 8.7 → 8.11 | The extra time is *inside* query spans, or in waiting to get a pool connection (watch `pool.waitingCount`, or time from connect to first query). Pool or connection settings behave differently. |
| An interaction between the two | For example, the middleware runs while a pool connection is checked out, or it logs query results, so the pool starves. Pool wait time rises only when the middleware is on. |
| Something else in the deploy | Config, env vars, instance size or a traffic change. Diff the whole deploy, not just these two items. |

**The fastest check:** turn the middleware off (feature flag or env var) on one instance, or a canary, and compare its p99 with the others. At the same time, look at a few slow traces and see whether the time is spent in DB calls or around them. Between them, those two observations should settle it.

**Decision rule:**
- Canary without the middleware recovers → fix the middleware. Make logging fire-and-forget or batched with a buffer, put a short timeout on it, and take it off the response path. Keep the driver.
- Canary stays slow, and the time is in queries or pool wait → then pin pg back to 8.7 and look into what changed.
- You can't run a canary quickly and users are hurting → roll back the whole deploy and reintroduce the two changes one at a time.

**Where I could be wrong:** if your traces already show the extra time inside query execution, your teammate is probably right and rolling back the driver is reasonable. That one observation is what decides it.
