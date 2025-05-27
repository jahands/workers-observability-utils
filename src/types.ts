export const METRICS_CHANNEL_NAME = "workers-observability-metrics";

export enum MetricType {
  COUNT = "COUNT",
  GAUGE = "GAUGE",
  HISTOGRAM = "HISTOGRAM",
}

export type Tags = Record<string, string | number | boolean | undefined | null>;

interface BaseMetricPayload {
  type: MetricType;
  name: string;
  value: number;
  tags: Tags;
}

export type HistogramAggregates =
  | "max"
  | "min"
  | "sum"
  | "avg"
  | "median"
  | "count";

export interface HistogramOptions {
  aggregates?: HistogramAggregates[];
  /**
  Percentiles can include any decimal between 0 and 1.
  */
  percentiles?: number[];
}

export interface CountMetricPayload extends BaseMetricPayload {
  type: MetricType.COUNT;
  value: number;
}

export interface GaugeMetricPayload extends BaseMetricPayload {
  type: MetricType.GAUGE;
  value: number;
}

export interface HistogramMetricPayload extends BaseMetricPayload {
  type: MetricType.HISTOGRAM;
  value: number;
  options: HistogramOptions;
}

export type MetricPayload =
  | CountMetricPayload
  | GaugeMetricPayload
  | HistogramMetricPayload;

export type ExportedMetricPayload = MetricPayload & { timestamp: number };

declare module "cloudflare:workers" {
  interface Env {
    DD_API_KEY?: string;
    DATADOG_API_KEY?: string;
  }
}
