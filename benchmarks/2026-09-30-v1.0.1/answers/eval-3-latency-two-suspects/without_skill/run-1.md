Not yet. You changed two things at once, and from what you've described, the logging middleware is at least as likely a cause as the driver. Possibly more likely.

**Why I'd suspect the middleware first**

- A synchronous or awaited call to a remote log service on every request adds a network round trip to each response. A slow or throttled log endpoint lands directly in your tail latency.
- p99 went up about 7x, to ~900ms. That looks like occasional waits on something external: log-service timeouts or retries, or backpressure when its buffer fills. It doesn't look like a uniform slowdown.
- A minor-version upgrade of pg from 8.7 to 8.11 rarely causes a regression this large. It isn't impossible, though. Pool behavior, connection handling and SSL defaults have shifted between versions, so don't rule the driver out.

**Check before rolling anything back (most of this takes minutes)**

1. **Traces or timing breakdown.** If you have APM or tracing, look at where the time goes in slow requests. Is it in DB spans or in the logging call? This alone may settle the question.
2. **DB query timings.** Compare query durations, and the time spent waiting to acquire a pool connection, before and after the deploy. If query time is flat, it's not the driver.
3. **Log service health.** Check the log service's response times and error or 429 rates, and look for timeouts in your app logs.
4. **Kill the middleware.** If it's behind a feature flag or config, turn it off. That's the cheapest and safest test, and it doesn't need a redeploy. If p99 drops back to ~120ms, you have your answer.
5. **Also check:** event-loop lag and CPU. Heavy JSON serialization of request/response bodies in the logger can block the loop, and that hurts p99 for everyone.

**If you need to mitigate right now**

Roll back the whole deploy, or change one variable at a time, starting with disabling the middleware because it's the easiest to reverse. Rolling back only the driver on a hunch could cost you a deploy cycle while users are still hurting. You could also end up blaming the wrong change.

**Longer term, whichever it turns out to be**

- Make request logging non-blocking: fire-and-forget, batched and async, with a bounded buffer that drops logs rather than blocking requests, and a short timeout.
- Or log to stdout and let a sidecar or agent ship the logs.
- Ship risky changes separately (or behind flags) so the next regression can be pinned to one change.

**Bottom line:** don't roll back only the driver yet. Disable the logging middleware first, or look at a trace. It's the more likely cause and the cheaper test. If latency stays high with logging off, then look at the driver.
