import { ExportedMetricPayload } from "../types";

export interface MetricSink {
  sendMetrics: (metrics: ExportedMetricPayload[]) => Promise<void>;
}
