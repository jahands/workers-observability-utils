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

    const { scriptName, executionModel, outcome, versionId, ...customTags } =
      payload.tags;

    const blobs: string[] = [];
    const doubles: number[] = [];

    // First blob is always the metric type
    blobs.push(payload.type);

    // Add doubles
    doubles.push(payload.timestamp);
    doubles.push(payload.value);

    // Add special tags in a fixed order (positions 2-9)
    blobs.push(`${scriptName || ""}`);
    blobs.push(`${executionModel || ""}`);
    blobs.push(`${outcome || ""}`);
    blobs.push(`${versionId || ""}`);

    // Reserve positions 6-10 for future special tags (empty strings for now)
    blobs.push("");
    blobs.push("");
    blobs.push("");
    blobs.push("");
    blobs.push("");
    blobs.push("");

    // Add custom tags starting from position 11
    for (const value of Object.values(customTags)) {
      blobs.push(`${value || ""}`);
    }

    return {
      blobs,
      doubles,
      index: [`${payload.name}#${scriptName}`.slice(0, 96)],
    };
  }
}
