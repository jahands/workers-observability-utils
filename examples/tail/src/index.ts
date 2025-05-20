import { TailExporter, DatadogMetricSink } from 'workers-observability-utils/tail';

export default new TailExporter({
	metrics: new DatadogMetricSink({
		site: 'us3.datadoghq.com',
	}),
});
