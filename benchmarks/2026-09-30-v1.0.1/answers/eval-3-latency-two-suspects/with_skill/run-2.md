**No, not on its own. Nothing so far points to the driver over the logging middleware, and my guess is the middleware is the more likely cause.** If users are hurting now, roll back the whole deploy to stop the bleeding. Then use one of the checks below to find the real cause before you ship again.

**Why I wouldn't bet on the driver alone**

Both changes went out together, so the timing fits either one equally well. Your teammate may still be right, but "it started after the deploy" doesn't separate the two. A few things make the middleware a strong suspect:

- It adds a network call to a remote service on the request path. If it awaits that call, or blocks on a full buffer or connection pool, every request pays the round trip. The p99 then picks up the log service's worst-case latency, retries or timeouts.
- A jump that shows up mostly at p99 (tail latency) is a typical sign of an occasionally slow remote dependency.
- pg 8.7 → 8.11 is a minor-version bump. It could still have changed something, such as pool or connection behavior, but I don't know of a specific regression that would explain this. Treat it as a possibility, not the default answer.

There are two other options to keep open: an interaction between the two (for example, the middleware logging query details, or holding the event loop while DB callbacks wait), or something else in the same deploy (config, env vars, instance sizing, a traffic change).

**Checks that separate the suspects (cheapest first)**

1. **Where does the extra time go?** Compare trace spans or timings for slow requests from before and after the deploy. If the extra time is inside DB query/connect spans, suspect the driver. If it's outside them (before or after the handler, in the logging call), suspect the middleware.
2. **Turn off the middleware on one instance or canary**, via a flag or config if you can, and compare p99 against the others. If p99 drops back to about 120ms, you have your answer. This is usually quicker and less risky than a dependency rollback.
3. **Check the logging code and the log service:** is the call awaited or fire-and-forget? What latency, error rate or timeouts does the log service show? Does p50 also rise, and by roughly one round trip?
4. **If the evidence points to the DB**, look at pool wait time versus query execution time, and at pool size and connection counts. Then roll back only the driver on a canary to confirm.

**Bottom line:** mitigate with a full rollback if needed. Then use check 1 or 2 to find which change is responsible. That's typically an hour of work, and it beats rolling back the driver, still seeing 900ms, and losing a day. What would change my view: if traces show the added time sitting inside pg query or connection-acquire spans, the driver moves to the top.
