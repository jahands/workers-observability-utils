import { ExportedMetricPayload } from "../types";
import { MetricSink } from "./sink";

export interface WAEMetricSinkOptions {
  /**
   * Analytics Engine dataset binding
   */
  datasetBinding: AnalyticsEngineDataset;
}

/**
 * A sink that sends metrics to Cloudflare Workers Analytics Engine
 */
export class WorkersAnalyticsEngineSink implements MetricSink {
  private readonly options: WAEMetricSinkOptions;

  constructor(options: WAEMetricSinkOptions) {
    this.options = options;
  }

  /**
   * Send multiple metrics to Workers Analytics Engine
   */
  async sendMetrics(payloads: ExportedMetricPayload[]): Promise<void> {
    for (const payload of payloads) {
      await this.sendMetric(payload);
    }
  }

  /**
   * Send a single metric to Workers Analytics Engine
   */
  private async sendMetric(payload: ExportedMetricPayload): Promise<void> {
    const dataset = this.options.datasetBinding;
    if (!dataset) {
      throw new Error(`Dataset binding not found`);
    }

    const { blobs, doubles, index } = this.transformMetric(payload);

    try {
      dataset.writeDataPoint({
        blobs: blobs.slice(0, 20),
        doubles: doubles.slice(0, 20),
        indexes: index,
      });
    } catch (error) {
      console.error(`Failed to write datapoint to Analytics Engine: ${error}`, {
        error,
      });
      throw error;
    }
  }

  /**
   * Transform a metric payload to Workers Analytics Engine format
   */
  private transformMetric(payload: ExportedMetricPayload): {
    blobs: string[];
    doubles: number[];
    index: [string];
  } {
    // Create a list of blobs and doubles
    const blobs: string[] = [];
    const doubles: number[] = [];

    blobs.push(payload.type);

    doubles.push(payload.timestamp);
    doubles.push(payload.value);

    // Format tags as blobs
    const tagValues = Object.values(payload.tags);

    for (const value of tagValues) {
      blobs.push(`${value}`);
    }

    return {
      blobs,
      doubles,
      index: [payload.name],
    };
  }
}
