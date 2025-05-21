/**
 * Workers Observability Utils
 *
 * A collection of utilities for capturing logs and metrics from Cloudflare Workers
 */

export * from "./metrics";
export * from "./tail";
export * from "./sinks/datadog";

import * as metrics from "./metrics";
import { TailExporter } from "./tail";
import { DatadogMetricSink } from "./sinks/datadog";
import { WorkersAnalyticsEngineSink } from "./sinks/wae";

export { metrics, TailExporter, DatadogMetricSink, WorkersAnalyticsEngineSink };
export default {
  metrics,
  TailExporter,
  DatadogMetricSink,
  WorkersAnalyticsEngineSink,
};
