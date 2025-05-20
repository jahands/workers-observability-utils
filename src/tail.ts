import { METRICS_CHANNEL_NAME, MetricPayload, MetricType } from "./types";
import { MetricsDb } from "./metricsDb";
import { TraceItem } from "@cloudflare/workers-types";
import type { MetricSink } from "./sinks/sink";
export { DatadogMetricSink } from "./sinks/datadog";
export interface LogPayload {
  level: string;
  message: string;
  timestamp: number;
  context?: Record<string, any>;
  [key: string]: any;
}

export interface TailExporterOptions {
  metrics?: MetricSink;
  options?: {
    /**
     * Max number of events to buffer before flushing.
     * Default: 1000
     */
    maxBufferSize?: number;
    /**
     * Max duration in Seconds to buffer before flushing.
     * Default: 5 Seconds
     */
    maxBufferDuration?: number;
  };
}

export class TailExporter {
  #metricSink?: MetricSink;
  #maxBufferSize: number;
  #maxBufferDuration: number;

  #metrics = new MetricsDb();
  #flushScheduled = false;
  #schedulerHandle: any = null;

  constructor({ metrics, options }: TailExporterOptions) {
    this.#metricSink = metrics;
    this.#maxBufferSize = options?.maxBufferSize || 100;
    this.#maxBufferDuration = Math.min(options?.maxBufferDuration || 5, 30);
  }

  tail(traceItems: TraceItem[], env: any, ctx: ExecutionContext) {
    for (const traceItem of traceItems) {
      const metricEvents = traceItem.diagnosticsChannelEvents.filter(
        (el) => el.channel === METRICS_CHANNEL_NAME,
      );
      for (const event of metricEvents) {
        const message = event.message;
        if (isValidMetric(message)) {
          this.#metrics.storeMetric(message);
        } else {
          console.warn("Received invalid metric payload:", message);
        }
      }
    }

    if (this.#metrics.getMetricCount() >= this.#maxBufferSize) {
      if (this.#flushScheduled && this.#schedulerHandle) {
        // Cancel the scheduled flush
        this.#schedulerHandle.abort();
        this.#flushScheduled = false;
      }

      // Flush immediately
      ctx.waitUntil(this.#performFlush());
      return;
    }

    // If a flush is already scheduled, don't schedule another one
    if (this.#flushScheduled) {
      return;
    }

    // Schedule a flush after maxBufferDuration
    this.#flushScheduled = true;

    const controller = new AbortController();
    const { signal } = controller;
    this.#schedulerHandle = controller;

    const scheduleFlush = async () => {
      try {
        await scheduler.wait(this.#maxBufferDuration * 1000, { signal });

        await this.#performFlush();
      } catch (error) {
        if (error instanceof Error) {
          // Handle abort error (this is expected when we cancel the scheduled flush)
          if (error.name !== "AbortError") {
            console.error("Error in scheduled flush:", error);
          }

          // Reset flush scheduled flag if aborted
          if (error.name === "AbortError") {
            this.#flushScheduled = false;
          }
        }
      }
    };

    // Wait for the scheduled flush to complete
    ctx.waitUntil(scheduleFlush());
  }

  // Private method to perform the actual flush
  async #performFlush(): Promise<void> {
    const items = this.#metrics.toMetricPayloads(this.#maxBufferDuration);

    // Reset batch and flush state
    this.#flushScheduled = false;
    this.#metrics.clearAll();
    this.#schedulerHandle = null;

    // Skip if no items to flush
    if (items.length === 0) {
      return;
    }

    try {
      await this.#metricSink?.sendMetrics?.(items);
    } catch (error) {
      console.error("Error flushing batch:", error);
    }
  }
}

function isValidMetric(message: unknown): message is MetricPayload {
  // Check if message is an object with all required properties
  if (
    message === null ||
    typeof message !== "object" ||
    !("type" in message) ||
    !("name" in message) ||
    !("value" in message) ||
    !("tags" in message) ||
    !("timestamp" in message)
  ) {
    return false;
  }

  const metricMsg = message as Partial<MetricPayload>;

  // Check if type is one of the valid MetricType values
  if (!Object.values(MetricType).includes(metricMsg.type as MetricType)) {
    return false;
  }

  // Validate field types (same for all metric types)
  return (
    typeof metricMsg.value === "number" &&
    typeof metricMsg.name === "string" &&
    typeof metricMsg.timestamp === "number" &&
    typeof metricMsg.tags === "object"
  );
}
