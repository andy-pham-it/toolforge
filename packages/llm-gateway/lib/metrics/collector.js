'use strict';

/**
 * Metrics collector for Prometheus exposition format.
 * Lightweight — no external dependencies.
 */
class MetricsCollector {
  constructor() {
    /** @type {Map<string, {help: string, type: string, entries: {labels: string, value: number}[]}>} */
    this._metrics = new Map();
    this._durations = [];
  }

  /**
   * Increment a counter by 1.
   * @param {string} name
   * @param {object} [labels]
   */
  increment(name, labels = {}) {
    this._counter(name, 1, labels);
  }

  /**
   * Add a value to a counter.
   * @param {string} name
   * @param {number} value
   * @param {object} [labels]
   */
  addToCounter(name, value, labels = {}) {
    this._counter(name, value, labels);
  }

  /**
   * Set a gauge to a specific value.
   * @param {string} name
   * @param {number} value
   * @param {object} [labels]
   */
  setGauge(name, value, labels = {}) {
    if (typeof value !== 'number') return;
    const entry = this._entry(name, 'gauge', 'Metrics gauge', labels);
    entry.value = value;
  }

  /**
   * Record a duration observation (histogram/summary).
   * @param {string} model
   * @param {string} provider
   * @param {number} seconds
   */
  observeDuration(model, provider, seconds) {
    this._durations.push({ model: model || '', provider: provider || '', seconds });
  }

  /**
   * Record token usage.
   * @param {string} model
   * @param {number} prompt
   * @param {number} completion
   */
  recordTokens(model, prompt, completion) {
    this.addToCounter('llm_tokens_total', prompt || 0, { model: model || '', type: 'prompt' });
    this.addToCounter('llm_tokens_total', completion || 0, { model: model || '', type: 'completion' });
  }

  /**
   * Record cost.
   * @param {string} model
   * @param {number} costUsd
   */
  recordCost(model, costUsd) {
    this.addToCounter('llm_cost_usd_total', costUsd || 0, { model: model || '' });
  }

  /** Check if any metrics have been recorded. */
  get isEmpty() {
    return this._metrics.size === 0 && this._durations.length === 0;
  }

  /** Reset all metrics. */
  reset() {
    this._metrics.clear();
    this._durations = [];
  }

  /**
   * Output Prometheus exposition format.
   * @returns {string}
   */
  formatPrometheus() {
    const lines = [];

    // Collect all metric families grouped by name
    const families = new Map(); // name -> { help, type, samples: string[] }

    const addSample = (name, help, type, sample) => {
      if (!families.has(name)) families.set(name, { help, type, samples: [] });
      families.get(name).samples.push(sample);
    };

    // Counters and gauges
    for (const [key, entry] of this._metrics) {
      const name = key.split('{')[0];
      const labels = key.includes('{') ? key.substring(key.indexOf('{')) : '';
      const sample = labels ? `${name}${labels} ${entry.value}` : `${name} ${entry.value}`;
      addSample(name, entry.help, entry.type, sample);
    }

    // Duration — emit as summary
    if (this._durations.length > 0) {
      const durName = 'llm_request_duration_seconds';
      const totalCount = this._durations.length;
      const totalSum = this._durations.reduce((s, d) => s + d.seconds, 0);
      const maxVal = this._durations.reduce((m, d) => Math.max(m, d.seconds), 0);

      addSample(durName, 'Request duration in seconds', 'summary', `${durName}_count ${totalCount}`);
      addSample(durName, 'Request duration in seconds', 'summary', `${durName}_sum ${totalSum}`);
      addSample(durName, 'Request duration in seconds', 'summary', `${durName}_max ${maxVal}`);

      // Per (model,provider) breakdown
      const byKey = {};
      for (const d of this._durations) {
        const k = `${d.model}|${d.provider}`;
        if (!byKey[k]) byKey[k] = { count: 0, sum: 0 };
        byKey[k].count++;
        byKey[k].sum += d.seconds;
      }
      for (const [k, data] of Object.entries(byKey)) {
        const [model, provider] = k.split('|');
        const labelStr = `model="${model}",provider="${provider}"`;
        addSample(durName, 'Request duration in seconds', 'summary', `${durName}_count{${labelStr}} ${data.count}`);
        addSample(durName, 'Request duration in seconds', 'summary', `${durName}_sum{${labelStr}} ${data.sum}`);
      }
    }

    // Emit grouped
    for (const [name, f] of families) {
      const typeLine = `# TYPE ${name} ${f.type}`;
      const helpLine = `# HELP ${name} ${f.help}`;
      // Only emit HELP/TYPE once
      if (!lines.includes(helpLine)) lines.push(helpLine);
      if (!lines.includes(typeLine)) lines.push(typeLine);
      for (const sample of f.samples) {
        if (!lines.includes(sample)) lines.push(sample);
      }
    }

    return lines.join('\n') + '\n';
  }

  /** @private */
  _entry(name, type, help, labels) {
    const key = labels && Object.keys(labels).length > 0
      ? `${name}{${this._labelString(labels)}}`
      : name;
    if (!this._metrics.has(key)) {
      this._metrics.set(key, { help, type, value: 0 });
    }
    return this._metrics.get(key);
  }

  /** @private */
  _counter(name, value, labels) {
    const entry = this._entry(name, 'counter', 'Metrics counter', labels);
    entry.value += value;
  }

  /** @private */
  _labelString(labels) {
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
  }
}

module.exports = MetricsCollector;
