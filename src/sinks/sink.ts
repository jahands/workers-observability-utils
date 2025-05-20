import { MetricPayload } from "../types";

export interface MetricSink {
  sendMetrics: (metrics: MetricPayload[]) => Promise<void>;
}
