import { METRICS_CHANNEL_NAME, MetricPayload, MetricType } from "./types";
import { MetricsDb } from "./metricsDb";
import { TraceItem } from "@cloudflare/workers-types";
import type { MetricSink } from "./sinks/sink";
export { DatadogMetricSink } from "./sinks/datadog";
export { WorkersAnalyticsEngineSink } from "./sinks/wae";

export interface LogPayload {
  level: string;
  message: string;
  timestamp: number;
  context?: Record<string, any>;
  [key: string]: any;
}

export interface TailExporterOptions {
  metrics?: {
    sinks: MetricSink[];
    defaultMetrics?: {
      cpuTime?: boolean; // default: true;
      wallTime?: boolean; // default: true;
      workersInvocation?: boolean; // default: true;
    };
    /**
     * Max number of unique metrics to buffer before flushing.
     * Metric Uniqueness is defined by a combination of name and tags
     * Default: 25
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
  #metricSinks?: MetricSink[];
  #maxBufferSize: number;
  #maxBufferDuration: number;
  #flushId: number = 0;
  #metrics = new MetricsDb();
  #flushScheduled = false;

  constructor({ metrics }: TailExporterOptions) {
    this.#metricSinks = metrics?.sinks;
    this.#maxBufferSize = metrics?.maxBufferSize || 100;
    this.#maxBufferDuration = Math.min(metrics?.maxBufferDuration || 5, 30);
  }

  tail(traceItems: TraceItem[], env: any, ctx: ExecutionContext) {
    for (const traceItem of traceItems) {
      const metricEvents = traceItem.diagnosticsChannelEvents.filter(
        (el) => el.channel === METRICS_CHANNEL_NAME,
      );

      const globalTags = {
        scriptName: traceItem.scriptName,
        executionModel: traceItem.executionModel,
        outcome: traceItem.outcome,
        versionId: traceItem.scriptVersion?.id,
      };

      for (const event of metricEvents) {
        const message = event.message;
        if (isValidMetric(message)) {
          this.#metrics.storeMetric({
            ...message,
            tags: {
              ...globalTags,
              ...message.tags,
            },
            timestamp: event.timestamp,
          });
        } else {
          console.warn("Received invalid metric payload:", message);
        }
      }
    }

    if (this.#metrics.getMetricCount() >= this.#maxBufferSize) {
      if (this.#flushScheduled) {
        this.#flushScheduled = false;
      }

      this.#flushId++;
      // Flush immediately
      ctx.waitUntil(this.#performFlush());
      return;
    }

    if (this.#flushScheduled) {
      return;
    }

    this.#flushScheduled = true;
    const scheduleFlush = async () => {
      try {
        const localFlushId = ++this.#flushId;
        await scheduler.wait(this.#maxBufferDuration * 1000);

        if (localFlushId === this.#flushId) {
          await this.#performFlush();
        }
      } catch (error) {}
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

    // Skip if no items to flush
    if (items.length === 0) {
      return;
    }

    try {
      if (this.#metricSinks) {
        const results = await Promise.allSettled(
          this.#metricSinks?.map((sink) => sink.sendMetrics(items)),
        );
        const errors = results.filter((el) => el.status === "rejected");
        for (const error of errors) {
          console.error("Failed to flush some metrics", {
            error: error.reason,
          });
        }
      }
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
    !("tags" in message)
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
    typeof metricMsg.tags === "object"
  );
}
