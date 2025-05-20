export const METRICS_CHANNEL_NAME = "workers-observability-metrics";
export enum MetricType {
  COUNT = "COUNT",
  RATE = "RATE",
  GAUGE = "GAUGE",
}

export type Tags = Record<string, string | number | boolean>;

interface BaseMetricPayload {
  type: MetricType;
  name: string;
  value: any;
  tags: Tags;
  timestamp: number;
}

export interface HistogramOptions {
  buckets?: number[];
}

export interface CountMetricPayload extends BaseMetricPayload {
  type: MetricType.COUNT;
  value: number;
}

export interface RateMetricPayload extends BaseMetricPayload {
  type: MetricType.RATE;
  value: number;
}

export interface GaugeMetricPayload extends BaseMetricPayload {
  type: MetricType.GAUGE;
  value: number;
}

export type MetricPayload =
  | CountMetricPayload
  | RateMetricPayload
  | GaugeMetricPayload;

// Cloudflare Workers environment variables
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DD_API_KEY?: string;
      DATADOG_API_KEY?: string;
    }
  }
}

// For Cloudflare Workers env binding
declare module "cloudflare:workers" {
  interface Env {
    DD_API_KEY?: string;
    DATADOG_API_KEY?: string;
  }
}