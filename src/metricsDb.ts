import { MetricPayload, MetricType, Tags } from "./types";

interface BaseStoredMetric {
  name: string;
  tags: Tags;
  lastUpdated: number;
}

interface StoredCountMetric extends BaseStoredMetric {
  type: MetricType.COUNT;
  value: number;
}

interface StoredGaugeMetric extends BaseStoredMetric {
  type: MetricType.GAUGE;
  value: number;
}

interface StoredRateMetric extends BaseStoredMetric {
  type: MetricType.RATE;
  value: number[];
  created: number;
}

type StoredMetric = StoredCountMetric | StoredGaugeMetric | StoredRateMetric;

function serializeTags(tags: Tags): string {
  return Object.entries(tags)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, value]) => `${key}:${value}`)
    .join(",");
}

/**
 * In-memory metrics database that stores metrics with different strategies
 * based on their type.
 */
export class MetricsDb {
  private metrics: Map<string, StoredMetric> = new Map();
  private getMetricKey(metric: MetricPayload): string {
    const tagKey = serializeTags(metric.tags);
    return `${metric.name}:${metric.type}:${tagKey}`;
  }

  /**
   * Store a metric in the database
   * - For COUNT metrics: accumulate the value
   * - For GAUGE metrics: store the latest value
   * - For RATE metrics: store an array of all values
   */
  public storeMetric(metric: MetricPayload & { timestamp: number }): void {
    const key = this.getMetricKey(metric);
    const existingMetric = this.metrics.get(key);

    switch (metric.type) {
      case MetricType.COUNT: {
        const newValue = existingMetric
          ? (existingMetric.value as number) + Number(metric.value)
          : Number(metric.value);

        this.metrics.set(key, {
          type: metric.type,
          name: metric.name,
          tags: metric.tags,
          value: newValue,
          lastUpdated: metric.timestamp,
        });
        break;
      }

      case MetricType.GAUGE: {
        this.metrics.set(key, {
          type: metric.type,
          name: metric.name,
          tags: metric.tags,
          value: Number(metric.value),
          lastUpdated: metric.timestamp,
        });
        break;
      }

      case MetricType.RATE: {
        const existingRateMetric = existingMetric as StoredRateMetric;
        const existingValues = existingRateMetric?.value || ([] as number[]);
        const created = existingRateMetric?.created || metric.timestamp;

        this.metrics.set(key, {
          type: metric.type,
          name: metric.name,
          tags: metric.tags,
          created: created,
          value: [...existingValues, Number(metric.value)],
          lastUpdated: metric.timestamp,
        });
        break;
      }
    }
  }

  /**
   * Store multiple metrics at once
   */
  public storeMetrics(
    metrics: (MetricPayload & { timestamp: number })[],
  ): void {
    for (const metric of metrics) {
      this.storeMetric(metric);
    }
  }

  /**
   * Get all stored metrics
   */
  public getAllMetrics(): StoredMetric[] {
    return Array.from(this.metrics.values());
  }

  public clearAll(): void {
    this.metrics.clear();
  }

  public getMetricCount(): number {
    return this.metrics.size;
  }

  /**
   * Convert stored metrics to MetricPayload format
   */
  public toMetricPayloads(flushWindowS: number): MetricPayload[] {
    const payloads: MetricPayload[] = [];

    for (const metric of this.metrics.values()) {
      switch (metric.type) {
        case MetricType.COUNT:
        case MetricType.GAUGE:
          payloads.push({
            type: metric.type,
            name: metric.name,
            value: metric.value as number,
            tags: metric.tags,
            timestamp: metric.lastUpdated,
          });
          break;

        case MetricType.RATE:
          const values = metric.value as number[];
          const value =
            values.reduce((acc, val) => acc + val, 0) / flushWindowS;
          payloads.push({
            type: metric.type,
            name: metric.name,
            value: value,
            tags: metric.tags,
            timestamp: metric.lastUpdated,
          });
          break;
      }
    }

    return payloads;
  }
}

// Export a singleton instance for easy use
export const metricsDb = new MetricsDb();

export default metricsDb;
