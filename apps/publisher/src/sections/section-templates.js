import { inferCategory, titleFromId } from '../lib/categories.js';

const CATEGORY_CONFIG = {
  welcome: {
    summary: 'Template for a hero-led welcome page with highlight cards and onboarding calls to action.',
    render: (title) => `
<section class="section doc" data-template="welcome">
  <div class="doc-content">
    <header>
      <p class="eyebrow">Welcome template</p>
      <h1>${title}</h1>
      <p class="lead">Introduce the tenant offering with a crisp positioning statement and a primary action.</p>
    </header>
    <div>
      <h2>Value pillars</h2>
      <ul>
        <li>Summarize the first benefit in one focused sentence.</li>
        <li>Highlight a differentiator that matters to your audience.</li>
        <li>Call out an operational promise (support, scale, cost, or speed).</li>
      </ul>
    </div>
    <div>
      <h2>Launch checklist</h2>
      <ol>
        <li>Define the promise in a single headline.</li>
        <li>List one call to action for new visitors.</li>
        <li>Showcase three quick proof points or partner logos.</li>
      </ol>
    </div>
    <aside>
      <h3>Quick links</h3>
      <ul>
        <li><a href="#">{{ Primary guide }}</a></li>
        <li><a href="#">{{ Pricing or packaging }}</a></li>
        <li><a href="#">{{ Support channel }}</a></li>
      </ul>
    </aside>
    <blockquote>
      <p>Use a short testimonial, mission statement, or founder quote to reinforce credibility.</p>
    </blockquote>
  </div>
</section>
    `.trim()
  },
  guide: {
    summary: 'Template for introductory guides with prerequisites, phased steps, and success criteria.',
    render: (title) => `
<section class="section doc" data-template="guide">
  <div class="doc-content">
    <header>
      <p class="eyebrow">Guide template</p>
      <h1>${title}</h1>
      <p class="lead">Use this structure to walk new tenants through concepts or setup flows without assuming prior context.</p>
    </header>
    <div>
      <h2>Audience</h2>
      <p>Define who should use this guide and what they should already know.</p>
      <ul>
        <li>Primary persona and role.</li>
        <li>Target environment or tooling.</li>
        <li>Expected time to complete the guide.</li>
      </ul>
    </div>
    <div>
      <h2>Prerequisites</h2>
      <ul>
        <li>{{ Accounts or credentials }}</li>
        <li>{{ Access to sandbox tools }}</li>
        <li>{{ Required hardware or environment }}</li>
      </ul>
    </div>
    <div>
      <h2>Implementation steps</h2>
      <ol>
        <li><strong>Phase 1:</strong> Outline the initial decisions or configurations.</li>
        <li><strong>Phase 2:</strong> Describe the hands-on tasks with expected outcomes.</li>
        <li><strong>Phase 3:</strong> Document validation, roll-out, and next actions.</li>
      </ol>
    </div>
    <div>
      <h2>Success checks</h2>
      <table>
        <thead>
          <tr>
            <th>Checkpoint</th>
            <th>How to test</th>
            <th>Owner</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{{ Configuration saved }}</td>
            <td>{{ Command or UI indicator }}</td>
            <td>{{ Persona }}</td>
          </tr>
          <tr>
            <td>{{ Connectivity verified }}</td>
            <td>{{ Metric or log }}</td>
            <td>{{ Persona }}</td>
          </tr>
          <tr>
            <td>{{ Feature enabled }}</td>
            <td>{{ Screenshot or report }}</td>
            <td>{{ Persona }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</section>
    `.trim()
  },
  reference: {
    summary: 'Template for technical reference pages that capture concepts, constraints, and integration notes.',
    render: (title) => `
<section class="section doc" data-template="reference">
  <div class="doc-content">
    <header>
      <p class="eyebrow">Reference template</p>
      <h1>${title}</h1>
      <p class="lead">Document the underlying concepts, invariants, and responsibilities that engineers must respect.</p>
    </header>
    <div>
      <h2>Concept summary</h2>
      <p>Describe the the core idea in two or three sentences. Keep it factual and implementation oriented.</p>
      <ul>
        <li>State the problem that this component solves.</li>
        <li>Outline what makes the approach distinctive.</li>
        <li>Clarify the boundary of the component.</li>
      </ul>
    </div>
    <div>
      <h2>Implementation notes</h2>
      <p>Break down how this element behaves in production environments.</p>
      <ul>
        <li>Lifecycle stages or state transitions.</li>
        <li>Performance considerations.</li>
        <li>Failure modes and protective measures.</li>
      </ul>
    </div>
    <div>
      <h2>Integration matrix</h2>
      <table>
        <thead>
          <tr>
            <th>Dependency</th>
            <th>Interaction</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{{ Upstream service }}</td>
            <td>{{ Data exchanged }}</td>
            <td>{{ Contract version }}</td>
          </tr>
          <tr>
            <td>{{ Downstream client }}</td>
            <td>{{ Protocol or channel }}</td>
            <td>{{ Rate limits }}</td>
          </tr>
          <tr>
            <td>{{ Operational contact }}</td>
            <td>{{ SLA or escalation }}</td>
            <td>{{ Ownership }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</section>
    `.trim()
  },
  technical: {
    summary: 'Template for system architecture or deep dive documents with diagram callouts and layered explanations.',
    render: (title) => `
<section class="section doc" data-template="technical">
  <div class="doc-content">
    <header>
      <p class="eyebrow">Architecture template</p>
      <h1>${title}</h1>
      <p class="lead">Capture the layered view of the platform with clear responsibilities and communication paths.</p>
    </header>
    <div>
      <h2>Layered overview</h2>
      <p>Detail each layer of the system from the entry point down to persistence or integrations.</p>
      <ol>
        <li>{{ Experience or API layer }}</li>
        <li>{{ Orchestration or service layer }}</li>
        <li>{{ Infrastructure or data layer }}</li>
      </ol>
    </div>
    <div>
      <h2>Diagram callouts</h2>
      <ul>
        <li>Insert diagram filename or location.</li>
        <li>List the components to label.</li>
        <li>Note any external dependencies.</li>
      </ul>
      <pre><code class="language-mermaid">graph TD
  A[Client] -->|{{ Protocol }}| B[Gateway]
  B --> C[Service Cluster]
  C --> D[Data or Time Authority]
</code></pre>
    </div>
    <div>
      <h2>Operational summary</h2>
      <blockquote>
        <p>Summarize the most important runtime behaviors, including scaling levers and recovery hooks.</p>
      </blockquote>
    </div>
  </div>
</section>
    `.trim()
  },
  developer: {
    summary: 'Template for developer-focused material featuring code examples, API usage, and quick start commands.',
    render: (title) => `
<section class="section doc" data-template="developer">
  <div class="doc-content">
    <header>
      <p class="eyebrow">Developer template</p>
      <h1>${title}</h1>
      <p class="lead">Guide engineers through integrating with the platform using concise examples and copyable snippets.</p>
    </header>
    <div>
      <h2>Before you begin</h2>
      <ul>
        <li>{{ Install the preferred SDK }}</li>
        <li>{{ Configure environment variables }}</li>
        <li>{{ Retrieve test credentials }}</li>
      </ul>
    </div>
    <div>
      <h2>Sample workflow</h2>
      <pre><code class="language-javascript">import { Client } from '@tenant/sdk';

const client = new Client({ endpoint: process.env.TENANT_API });
const response = await client.connect({
  workspace: '{{ workspace-id }}',
  token: process.env.TENANT_TOKEN,
});

console.log('Connected:', response.status);
</code></pre>
    </div>
    <div>
      <h2>Key methods</h2>
      <table>
        <thead>
          <tr>
            <th>Method</th>
            <th>Purpose</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>initialize()</code></td>
            <td>Set up configuration and authentication.</td>
            <td>Call once per application lifecycle.</td>
          </tr>
          <tr>
            <td><code>submitTask()</code></td>
            <td>Send a time-sensitive job to the network.</td>
            <td>Include idempotency keys.</td>
          </tr>
          <tr>
            <td><code>watchStatus()</code></td>
            <td>Subscribe to updates and react to state changes.</td>
            <td>Handles retries internally.</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div>
      <h2>Next steps</h2>
      <ul>
        <li>Link to extended examples.</li>
        <li>Point to sandbox or mock services.</li>
        <li>Outline production readiness checks.</li>
      </ul>
    </div>
  </div>
</section>
    `.trim()
  },
  governance: {
    summary: 'Template for governance documentation covering decision models, roles, and proposal lifecycles.',
    render: (title) => `
<section class="section doc" data-template="governance">
  <div class="doc-content">
    <header>
      <p class="eyebrow">Governance template</p>
      <h1>${title}</h1>
      <p class="lead">Explain how decisions are made, who participates, and how outcomes are recorded across tenants.</p>
    </header>
    <div>
      <h2>Decision model</h2>
      <p>Summarize the governance structure in plain language.</p>
      <ul>
        <li>{{ Council or committee scope }}</li>
        <li>{{ Voting mechanism }}</li>
        <li>{{ Quorum or approval threshold }}</li>
      </ul>
    </div>
    <div>
      <h2>Roles and responsibilities</h2>
      <table>
        <thead>
          <tr>
            <th>Role</th>
            <th>Accountabilities</th>
            <th>Tenure</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{{ Operator }}</td>
            <td>{{ Executes approved changes }}</td>
            <td>{{ Duration or rotation }}</td>
          </tr>
          <tr>
            <td>{{ Reviewer }}</td>
            <td>{{ Evaluates proposals }}</td>
            <td>{{ Duration or rotation }}</td>
          </tr>
          <tr>
            <td>{{ Treasurer }}</td>
            <td>{{ Manages budget or reserves }}</td>
            <td>{{ Duration or rotation }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div>
      <h2>Proposal lifecycle</h2>
      <ol>
        <li>Draft and collect supporting context.</li>
        <li>Publish for review and comment.</li>
        <li>Formal vote and implementation planning.</li>
        <li>Retrospective and transparent reporting.</li>
      </ol>
    </div>
  </div>
</section>
    `.trim()
  },
  product: {
    summary: 'Template for product-oriented pages showing positioning, features, and packaging options.',
    render: (title) => `
<section class="section doc" data-template="product">
  <div class="doc-content">
    <header>
      <p class="eyebrow">Product template</p>
      <h1>${title}</h1>
      <p class="lead">Capture how this offer solves a customer problem and how it is packaged across tenants.</p>
    </header>
    <div>
      <h2>Positioning</h2>
      <p>Describe what the product does, who it is for, and the primary outcomes.</p>
      <ul>
        <li>Problem statement.</li>
        <li>Solution narrative.</li>
        <li>Proof or validation.</li>
      </ul>
    </div>
    <div>
      <h2>Feature highlights</h2>
      <ul>
        <li><strong>{{ Feature name }}</strong> — Explain the capability in a single sentence.</li>
        <li><strong>{{ Feature name }}</strong> — Outline what makes it distinct.</li>
        <li><strong>{{ Feature name }}</strong> — Tie back to measurable outcomes.</li>
      </ul>
    </div>
    <div>
      <h2>Packaging</h2>
      <table>
        <thead>
          <tr>
            <th>Plan</th>
            <th>Includes</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{{ Starter }}</td>
            <td>{{ Core features }}</td>
            <td>{{ Ideal audience }}</td>
          </tr>
          <tr>
            <td>{{ Growth }}</td>
            <td>{{ Advanced options }}</td>
            <td>{{ Volume considerations }}</td>
          </tr>
          <tr>
            <td>{{ Enterprise }}</td>
            <td>{{ Custom commitments }}</td>
            <td>{{ Contact channel }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</section>
    `.trim()
  },
  resource: {
    summary: 'Template for resource collections such as FAQs, glossaries, or download libraries.',
    render: (title) => `
<section class="section doc" data-template="resource">
  <div class="doc-content">
    <header>
      <p class="eyebrow">Resource template</p>
      <h1>${title}</h1>
      <p class="lead">Share supporting materials, definitions, and reference links for tenant operators.</p>
    </header>
    <div>
      <h2>Collections</h2>
      <ul>
        <li>{{ Guide or handbook }} — Brief description.</li>
        <li>{{ Policy or playbook }} — Brief description.</li>
        <li>{{ Template or worksheet }} — Brief description.</li>
      </ul>
    </div>
    <div>
      <h2>Document index</h2>
      <table>
        <thead>
          <tr>
            <th>Resource</th>
            <th>Format</th>
            <th>Owner</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{{ Starter kit }}</td>
            <td>PDF</td>
            <td>{{ Team }}</td>
          </tr>
          <tr>
            <td>{{ API checklist }}</td>
            <td>Spreadsheet</td>
            <td>{{ Team }}</td>
          </tr>
          <tr>
            <td>{{ Messaging assets }}</td>
            <td>Archive</td>
            <td>{{ Team }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div>
      <h2>Support channels</h2>
      <ul>
        <li>Email: <code>support@example.com</code></li>
        <li>Slack: <code>#tenant-help</code></li>
        <li>Office hours: {{ Weekly cadence }}</li>
      </ul>
    </div>
  </div>
</section>
    `.trim()
  },
  security: {
    summary: 'Template for security pages detailing trust posture, controls, and reporting processes.',
    render: (title) => `
<section class="section doc" data-template="security">
  <div class="doc-content">
    <header>
      <p class="eyebrow">Security template</p>
      <h1>${title}</h1>
      <p class="lead">Explain how the platform manages risk, handles incidents, and communicates with stakeholders.</p>
    </header>
    <div>
      <h2>Security posture</h2>
      <ul>
        <li>Shared responsibility model.</li>
        <li>Data classification guidelines.</li>
        <li>Identity and access policies.</li>
      </ul>
    </div>
    <div>
      <h2>Controls</h2>
      <table>
        <thead>
          <tr>
            <th>Control</th>
            <th>Objective</th>
            <th>Evidence</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{{ Monitoring }}</td>
            <td>{{ Detect drift }}</td>
            <td>{{ Dashboard link }}</td>
          </tr>
          <tr>
            <td>{{ Incident playbook }}</td>
            <td>{{ Contain impact }}</td>
            <td>{{ Checklist reference }}</td>
          </tr>
          <tr>
            <td>{{ Vendor review }}</td>
            <td>{{ Assess third parties }}</td>
            <td>{{ Report cadence }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div>
      <h2>Reporting</h2>
      <p>Describe how to disclose vulnerabilities and how communication flows during an incident.</p>
      <blockquote>
        <p>Example email: <code>security@example.com</code></p>
      </blockquote>
    </div>
  </div>
</section>
    `.trim()
  },
  tutorial: {
    summary: 'Template for actionable, step-by-step tutorials with prerequisites and validation tasks.',
    render: (title) => `
<section class="section doc" data-template="tutorial">
  <div class="doc-content">
    <header>
      <p class="eyebrow">Tutorial template</p>
      <h1>${title}</h1>
      <p class="lead">Walk through a structured exercise with clear checkpoints and expected outputs.</p>
    </header>
    <div>
      <h2>Prerequisites</h2>
      <ul>
        <li>{{ Access token or credentials }}</li>
        <li>{{ Local environment tools }}</li>
        <li>{{ Sample project or dataset }}</li>
      </ul>
    </div>
    <div>
      <h2>Steps</h2>
      <ol>
        <li><strong>Set up:</strong> Outline the initial command or configuration.</li>
        <li><strong>Implement:</strong> Explain the core action the user should complete.</li>
        <li><strong>Validate:</strong> Provide an observable success signal.</li>
      </ol>
    </div>
    <div>
      <h2>Code sample</h2>
      <pre><code class="language-python">from tenant import Client

client = Client(api_key="{{ api-key }}")
client.schedule(
    task="{{ task-name }}",
    execute_at="{{ timestamp }}",
)
</code></pre>
    </div>
    <div>
      <h2>Troubleshooting</h2>
      <ul>
        <li>{{ Symptom }} — {{ Likely fix }}</li>
        <li>{{ Symptom }} — {{ Likely fix }}</li>
        <li>{{ Symptom }} — {{ Likely fix }}</li>
      </ul>
    </div>
  </div>
</section>
    `.trim()
  },
  'tutorial-overview': {
    summary: 'Template for tutorial indexes highlighting available walkthroughs and learning paths.',
    render: (title) => `
<section class="section doc" data-template="tutorial-overview">
  <div class="doc-content">
    <header>
      <p class="eyebrow">Tutorial index template</p>
      <h1>${title}</h1>
      <p class="lead">Provide curated learning paths so tenants can pick the right hands-on guide.</p>
    </header>
    <div>
      <h2>Getting started first</h2>
      <ul>
        <li><strong>{{ Tutorial name }}</strong> — Onboarding fundamentals.</li>
        <li><strong>{{ Tutorial name }}</strong> — Core integration walkthrough.</li>
        <li><strong>{{ Tutorial name }}</strong> — Validation and deployment.</li>
      </ul>
    </div>
    <div>
      <h2>Choose a path</h2>
      <table>
        <thead>
          <tr>
            <th>Track</th>
            <th>Includes</th>
            <th>Outcome</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Builders</td>
            <td>SDK setup, first data flow.</td>
            <td>Prototype in sandbox.</td>
          </tr>
          <tr>
            <td>Operators</td>
            <td>Monitoring, alerting, runbooks.</td>
            <td>Healthy day-two operations.</td>
          </tr>
          <tr>
            <td>Analysts</td>
            <td>Reporting, dashboards, exports.</td>
            <td>Insights shared with stakeholders.</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div>
      <h2>Where to ask questions</h2>
      <p>List channels (chat, office hours, email) and expected response times.</p>
    </div>
  </div>
</section>
    `.trim()
  },
  'use-case': {
    summary: 'Template for use case narratives that connect personas, workflows, and success metrics.',
    render: (title) => `
<section class="section doc" data-template="use-case">
  <div class="doc-content">
    <header>
      <p class="eyebrow">Use case template</p>
      <h1>${title}</h1>
      <p class="lead">Show how the platform supports a real scenario with tangible value and measurable outcomes.</p>
    </header>
    <div>
      <h2>Scenario overview</h2>
      <p>Describe the environment, triggers, and desired end state.</p>
    </div>
    <div>
      <h2>Personas</h2>
      <ul>
        <li>{{ Persona }} — Motivation and core responsibility.</li>
        <li>{{ Persona }} — Motivation and core responsibility.</li>
        <li>{{ Persona }} — Motivation and core responsibility.</li>
      </ul>
    </div>
    <div>
      <h2>Workflow</h2>
      <ol>
        <li>Initiate the event and capture inputs.</li>
        <li>Process through automation or smart logic.</li>
        <li>Deliver outputs and confirm success signals.</li>
      </ol>
    </div>
    <div>
      <h2>Success metrics</h2>
      <table>
        <thead>
          <tr>
            <th>Metric</th>
            <th>Target</th>
            <th>How to measure</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{{ Latency }}</td>
            <td>{{ Goal }}</td>
            <td>{{ Tool }}</td>
          </tr>
          <tr>
            <td>{{ Accuracy }}</td>
            <td>{{ Goal }}</td>
            <td>{{ Tool }}</td>
          </tr>
          <tr>
            <td>{{ Cost }}</td>
            <td>{{ Goal }}</td>
            <td>{{ Tool }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</section>
    `.trim()
  },
  operations: {
    summary: 'Template for operations runbooks with checklists, monitoring, and escalation paths.',
    render: (title) => `
<section class="section doc" data-template="operations">
  <div class="doc-content">
    <header>
      <p class="eyebrow">Operations template</p>
      <h1>${title}</h1>
      <p class="lead">Provide practical guidance for running tenant infrastructure and maintaining uptime.</p>
    </header>
    <div>
      <h2>Daily checklist</h2>
      <ul>
        <li>Review health dashboards.</li>
        <li>Verify synchronization status.</li>
        <li>Confirm alerting channels are green.</li>
      </ul>
    </div>
    <div>
      <h2>Maintenance windows</h2>
      <table>
        <thead>
          <tr>
            <th>Activity</th>
            <th>Frequency</th>
            <th>Owner</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{{ Software updates }}</td>
            <td>{{ Weekly or monthly }}</td>
            <td>{{ Team or person }}</td>
          </tr>
          <tr>
            <td>{{ Hardware checks }}</td>
            <td>{{ Frequency }}</td>
            <td>{{ Team or person }}</td>
          </tr>
          <tr>
            <td>{{ Backup validation }}</td>
            <td>{{ Frequency }}</td>
            <td>{{ Team or person }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div>
      <h2>Escalation path</h2>
      <ol>
        <li>Identify severity and capture logs.</li>
        <li>Notify primary on-call channel.</li>
        <li>Engage platform support or vendor partner.</li>
      </ol>
    </div>
    <div>
      <h2>Reference commands</h2>
      <pre><code class="language-bash"># Replace placeholders with tenant specific values
check-sync --endpoint {{ endpoint }}
validate-health --node {{ node-id }}
</code></pre>
    </div>
  </div>
</section>
    `.trim()
  },
  archive: {
    summary: 'Template for archival timelines and historical notes across releases or initiatives.',
    render: (title) => `
<section class="section doc" data-template="archive">
  <div class="doc-content">
    <header>
      <p class="eyebrow">Archive template</p>
      <h1>${title}</h1>
      <p class="lead">Record key milestones, artifacts, and retrospective notes for posterity.</p>
    </header>
    <div>
      <h2>Milestones</h2>
      <dl>
        <dt>{{ 2023-01 }}</dt>
        <dd>Summarize the release or initiative.</dd>
        <dt>{{ 2023-06 }}</dt>
        <dd>Highlight notable learnings.</dd>
        <dt>{{ 2023-12 }}</dt>
        <dd>Capture outcomes and follow-up actions.</dd>
      </dl>
    </div>
    <div>
      <h2>Artifacts</h2>
      <ul>
        <li>{{ Link to design doc }}</li>
        <li>{{ Link to demo recording }}</li>
        <li>{{ Link to postmortem }}</li>
      </ul>
    </div>
    <div>
      <h2>Future considerations</h2>
      <blockquote>
        <p>Document open questions or unresolved ideas worth revisiting.</p>
      </blockquote>
    </div>
  </div>
</section>
    `.trim()
  },
  default: {
    summary: 'Flexible documentation template to capture narrative, lists, and structured data.',
    render: (title) => `
<section class="section doc" data-template="general">
  <div class="doc-content">
    <header>
      <p class="eyebrow">Documentation template</p>
      <h1>${title}</h1>
      <p class="lead">Adapt this flexible layout to communicate policies, notes, or supporting context.</p>
    </header>
    <div>
      <h2>Overview</h2>
      <p>Summarize the topic in one or two paragraphs.</p>
    </div>
    <div>
      <h2>Key points</h2>
      <ul>
        <li>{{ Highlight a key decision }}</li>
        <li>{{ Capture a supporting metric }}</li>
        <li>{{ Reference a related doc }}</li>
      </ul>
    </div>
    <div>
      <h2>Details</h2>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Description</th>
            <th>Owner</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{{ Topic }}</td>
            <td>{{ Notes }}</td>
            <td>{{ Team }}</td>
          </tr>
          <tr>
            <td>{{ Topic }}</td>
            <td>{{ Notes }}</td>
            <td>{{ Team }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</section>
    `.trim()
  }
};

export function getSectionMetadata(id, overrides = {}) {
  const category = inferCategory(id);
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.default;
  return {
    id,
    title: overrides.title || titleFromId(id),
    summary: overrides.summary || config.summary,
    category
  };
}

// Re-export for backward compatibility
export { titleFromId } from '../lib/categories.js';

export function renderSectionTemplate({ id, title }) {
  const metadata = getSectionMetadata(id, { title });
  const config = CATEGORY_CONFIG[metadata.category] || CATEGORY_CONFIG.default;
  const finalTitle = metadata.title;
  return config.render(finalTitle, metadata).trim();
}

export function ensureCategory(id) {
  return getSectionMetadata(id).category;
}
