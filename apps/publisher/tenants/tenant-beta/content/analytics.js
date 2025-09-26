const CARDS = [
  { title: 'Fulfillment throughput', primary: '12.4k orders/day', trend: '+6.1%', tone: 'positive' },
  { title: 'Automation exceptions', primary: '14 open', trend: '-3 vs. last week', tone: 'neutral' },
  { title: 'Compliance status', primary: '100% green', trend: 'Audit ready', tone: 'positive' }
];

function renderCard(card) {
  const tone = card.tone === 'positive' ? 'card-positive' : card.tone === 'negative' ? 'card-negative' : 'card-neutral';
  return `
      <article class="metric-card ${tone}">
        <h3>${card.title}</h3>
        <p class="metric-primary">${card.primary}</p>
        <p class="metric-trend">${card.trend}</p>
      </article>`;
}

export async function load() {
  const cardsHtml = CARDS.map(renderCard).join('\n');
  const html = `
<section class="section doc" data-template="analytics">
  <div class="doc-content">
    <header>
      <p class="eyebrow">Operations intelligence</p>
      <h1>Analytics dashboard starter</h1>
      <p class="lead">Use these cards as the base for your executive telemetry view.</p>
    </header>
    <div class="metric-grid">
${cardsHtml}
    </div>
    <style>
      .metric-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 1.5rem;
      }
      .metric-card {
        padding: 1.5rem;
        border-radius: 0.75rem;
        background: #111827;
        color: #f9fafb;
        box-shadow: 0 16px 24px rgba(15, 23, 42, 0.2);
      }
      .metric-card h3 {
        font-size: 1rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: 0.75rem;
      }
      .metric-primary {
        font-size: 1.75rem;
        margin: 0;
      }
      .metric-trend {
        margin-top: 0.5rem;
        color: rgba(249, 250, 251, 0.7);
      }
      .card-positive {
        border: 1px solid rgba(16, 185, 129, 0.6);
      }
      .card-neutral {
        border: 1px solid rgba(96, 165, 250, 0.4);
      }
      .card-negative {
        border: 1px solid rgba(248, 113, 113, 0.6);
      }
    </style>
  </div>
</section>`;

  return { html };
}
