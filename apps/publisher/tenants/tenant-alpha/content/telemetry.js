const METRICS = [
  { label: 'Command latency (p95)', value: '118 ms', target: '< 150 ms' },
  { label: 'Packet success rate', value: '99.998%', target: '>= 99.990%' },
  { label: 'Relay uptime (30d)', value: '100%', target: '>= 99.995%' }
];

export async function load() {
  const rows = METRICS.map((metric) => `
      <tr>
        <td>${metric.label}</td>
        <td>${metric.value}</td>
        <td>${metric.target}</td>
      </tr>`).join('\n');

  const html = `
<section class="section doc" data-template="metrics">
  <div class="doc-content">
    <header>
      <p class="eyebrow">Observability snapshot</p>
      <h1>Telemetry dashboard overview</h1>
      <p class="lead">Track these indicators during your first 48 hours in production.</p>
    </header>
    <table>
      <thead>
        <tr>
          <th>Signal</th>
          <th>Current value</th>
          <th>Target</th>
        </tr>
      </thead>
      <tbody>
${rows}
      </tbody>
    </table>
    <aside>
      <h2>Next steps</h2>
      <ul>
        <li><a href="https://example.com/atlas/observability" target="_blank" rel="noopener">Enable Atlas Metrics streaming</a></li>
        <li><a href="https://example.com/atlas/dashboards" target="_blank" rel="noopener">Import the Grafana starter pack</a></li>
        <li><a href="https://example.com/atlas/alerts" target="_blank" rel="noopener">Configure alert policies</a></li>
      </ul>
    </aside>
  </div>
</section>`;

  return { html };
}
