import type { ExportedMetricPayload } from "../types";
import { env } from "cloudflare:workers";
import type { MetricSink } from "./sink";
export interface DatadogMetricSinkOptions {
  /**
   * Datadog API key
   */
  apiKey?: string;

  /**
   * Datadog site (default: 'datadoghq.com')
   */
  site?: string;

  /**
   * Custom endpoint URL override (for testing or proxies)
   */
  endpoint?: string;
}

/**
 * A sink that sends metrics to Datadog
 */
export class DatadogMetricSink implements MetricSink {
  private readonly options: {
    apiKey?: string;
    site?: string;
    endpoint?: string;
  };

  constructor(options?: DatadogMetricSinkOptions) {
    this.options = {
      apiKey: options?.apiKey,
      site: options?.site || "datadoghq.com",
      endpoint: options?.endpoint,
    };
  }

  /**
   * Send multiple metrics to Datadog
   */
  async sendMetrics(payloads: ExportedMetricPayload[]): Promise<void> {
    if (!payloads || payloads.length === 0) {
      return;
    }
    
    try {
      const datadogMetrics = payloads.map((payload) =>
        this.transformMetric(payload),
      );
      await this.sendToDatadog(datadogMetrics);
    } catch (error) {
      throw new Error(`Failed to send metrics to Datadog: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Transform a metric payload to Datadog format
   */
  private transformMetric(payload: ExportedMetricPayload): DatadogMetric {
    const formattedTags = Object.entries(payload.tags).map(
      ([key, value]) => `${key}:${value}`,
    );

    const metricType = payload.type.toLowerCase();

    return {
      metric: payload.name,
      type: metricType,
      points: [[Math.floor(payload.timestamp / 1000), payload.value]],
      tags: formattedTags,
    };
  }

  /**
   * Send metrics to Datadog API
   */
  private async sendToDatadog(metrics: DatadogMetric[]): Promise<void> {
    const endpoint =
      this.options.endpoint || `https://api.${this.options.site}/api/v1/series`;
    
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "DD-API-KEY":
          // @ts-ignore
          env.DD_API_KEY || env.DATADOG_API_KEY || this.options.apiKey,
      },
      body: JSON.stringify({ series: metrics }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Datadog API error (${response.status}): ${text}`);
    }
  }
}

interface DatadogMetric {
  metric: string;
  type: string;
  points: [number, number][]; // [timestamp, value]
  tags: string[];
}
