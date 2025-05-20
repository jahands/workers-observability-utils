import { channel, Channel } from "node:diagnostics_channel";
import { MetricPayload, METRICS_CHANNEL_NAME, MetricType, Tags } from "./types";

const metricsChannel: Channel = channel(METRICS_CHANNEL_NAME);

function publishMetric(
  type: MetricType,
  name: string,
  value: any,
  tags: Tags = {},
  additionalData: Record<string, any> = {},
): void {
  metricsChannel.publish({
    type,
    name,
    value,
    tags,
    timestamp: Date.now(),
    ...additionalData,
  } as MetricPayload);
}

export const metrics = {
  /**
   * Record a count metric
   * @param name - The metric name
   * @param value - The count value (incremented by)
   * @param tags - Optional tags
   */
  count(name: string, value: number = 1, tags: Tags = {}): void {
    publishMetric(MetricType.COUNT, name, value, tags);
  },

  /**
   * Record a rate metric
   * @param name - The metric name
   * @param value - The rate value
   * @param tags - Optional tags
   */
  rate(name: string, value: number = 1, tags: Tags = {}): void {
    publishMetric(MetricType.RATE, name, value, tags);
  },

  /**
   * Record a gauge metric
   * @param name - The metric name
   * @param value - The gauge value
   * @param tags - Optional tags
   */
  gauge(name: string, value: number, tags: Tags = {}): void {
    publishMetric(MetricType.GAUGE, name, value, tags);
  },
};

export default metrics;
