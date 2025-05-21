import { env } from 'cloudflare:workers';
import { DatadogMetricSink, TailExporter, WorkersAnalyticsEngineSink } from 'workers-observability-utils/tail';

export default new TailExporter({
	metrics: {
		sinks: [
			new DatadogMetricSink({
				site: 'us3.datadoghq.com',
			}),
			new WorkersAnalyticsEngineSink({
				datasetBinding: env.METRICS_DATASET,
			}),
		],
		maxBufferSize: 25,
		maxBufferDuration: 5,
	},
});
