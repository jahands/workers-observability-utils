# Workers Observability Utils

A lightweight, zero-dependency package for capturing and exporting metrics from Cloudflare Workers.

## Features

- Collect and track `COUNT`, `GAUGE`, and `HISTOGRAM` metrics
- Auto-aggregation of metrics based on type
- Tag support for all metrics
- Export metrics to multiple sinks (Datadog, Workers Analytics Engine)
- Separate Tail Worker architecture for efficient metrics exporting

## Basic Usage

### Setting Up Metrics in Your Worker

The main worker will capture metrics and publish them through a diagnostics channel. The `metrics` object provides methods for recording different types of metrics:

```typescript
import * as metrics from 'workers-observability-utils/metrics';

export default {
  async fetch(request, env, ctx) {
    // Record count metric with tags
    metrics.count('worker.request', 1, {
      method: request.method,
    });

    // Record gauge metric
    metrics.gauge('worker.connections.active', 42);

    // Record histogram metric for response time
    const startTime = Date.now();
    const response = await processRequest();
    const responseTime = Date.now() - startTime;
    metrics.histogram('worker.response_time', responseTime, {
      percentiles: [0.5, 0.95, 0.99],
      aggregates: ['avg', 'max']
    });

    return response;
  },
};
```

### Metric Types

This library supports three types of metrics:

1. **COUNT** - Cumulative counters that only increase (e.g., request count, error count)
   ```typescript
   metrics.count('worker.request', 1, { status: '200' });
   ```

2. **GAUGE** - Point-in-time measurement (e.g., memory usage, connection count)
   ```typescript
   metrics.gauge('worker.memory_usage', memoryUsage, { region: 'us-east' });
   ```

3. **HISTOGRAM** - Distribution of values over time with statistical aggregations
   ```typescript
   metrics.histogram('worker.response_time', responseTimeMs, {
     percentiles: [0.5, 0.95, 0.99],  // p50, p95, and p99 percentiles
     aggregates: ['avg', 'max', 'min', 'sum', 'count']
   }, { endpoint: '/api' });
   ```

   Histogram metrics automatically generate multiple derived metrics:
   - Percentiles (as gauges): `worker.response_time.p50`, `worker.response_time.p95`, etc.
   - Aggregates: `worker.response_time.avg`, `worker.response_time.max`, etc.

### Tags

All metrics support tags, which are key-value pairs that help categorize and filter metrics:

```typescript
metrics.count('worker.request', 1, {
  method: 'GET',
  path: '/api',
  status: '200'
});
```

## Setting Up the Tail Worker

To efficiently export metrics to external providers, you should set up a dedicated Tail Worker. This architecture allows your main worker to focus on handling requests, while the Tail Worker handles metric collection and export. For more information, see the [Cloudflare Tail Workers documentation](https://developers.cloudflare.com/workers/observability/logs/tail-workers/).

### Why Use a Tail Worker?

- **Separation of concerns**: Your main worker focuses on business logic
- **Performance**: Metric exporting won't impact your main worker's performance
- **Resilience**: Failures in metric reporting won't affect your main worker
- **Batching**: Efficiently aggregates and exports metrics in batches
- **No added latency**: Metrics processing happens asynchronously

### Tail Worker Configuration

1. Create a new Worker for handling tail events:

```typescript
// tail-worker/src/index.ts
import { TailExporter, DatadogMetricSink, WorkersAnalyticsEngineSink } from 'workers-observability-utils/tail';

export default new TailExporter({
  metrics: {
    sinks: [
      new DatadogMetricSink({
        site: 'us3.datadoghq.com',
        // API key can be provided here or via environment variables
        // apiKey: 'your-datadog-api-key'
      }),
      new WorkersAnalyticsEngineSink({
        datasetBinding: env.ANALYTICS_ENGINE_DATASET
      })
    ],
    // When using Workers Analytics Engine, a value of 20 or less is recommended due to soft limits
    maxBufferSize: 20,
    // Maximum duration in seconds to buffer before flushing (default: 5, max: 30)
    maxBufferDuration: 5
  }
});
```

2. Set up Datadog API key:

```bash
# Using wrangler secrets
wrangler secret put DD_API_KEY
# Or DATADOG_API_KEY is also supported
```

2. Configure your Worker:

```jsonc
// wrangler.jsonc for the Emitting Worker
{
  "name": "my-worker",
  // Required: Enable the tail_consumers configuration
  "tail_consumers": [
    {
      "service": "name-of-tail-worker",
    }
  ]
}
```

### Environment Variables and Bindings

The Tail Worker supports the following environment variables and bindings:

#### For Datadog
- `DD_API_KEY` or `DATADOG_API_KEY`: Your Datadog API key

#### For Workers Analytics Engine
- Requires an Analytics Engine dataset binding in your wrangler.jsonc:
```jsonc
{
  "analytics_engine_datasets": [
    {
      "binding": "ANALYTICS_ENGINE_DATASET",
      "dataset": "your-dataset-name"
    }
  ]
}
```

**Note**: Workers Analytics Engine has a soft limit of 25 writes per invocation, so it's recommended to keep your maxBufferSize at 20 or lower when using this sink.
