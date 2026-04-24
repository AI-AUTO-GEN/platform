const fs = require('fs');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0NWFhY2NhYS01NTFiLTQ4NjAtYmJkYi00ZjBkZjVmNjFjMzEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWViOTA1M2ItMzYwYi00NDA1LThiZjUtOTcyMzcwOTM0NDU0IiwiaWF0IjoxNzc2ODY2MDg0fQ.oM6YPppDo2I1WOyjxWt8CJ88PidV1NWAoTd6lX49RZ4';
const URL = 'https://nsk404.app.n8n.cloud/api/v1/workflows/fhQyHZy64VscaQ8Q';
const SECURE_WEBHOOK_SECRET = 'sk_renderfarm_n8n_secure_2026';

async function run() {
  const res = await fetch(URL, { headers: { 'X-N8N-API-KEY': API_KEY } });
  const wf = await res.json();

  let modified = false;

  ['Billing Hold', 'Billing Liquidate', 'Billing Refund'].forEach(nodeName => {
    const node = wf.nodes.find(n => n.name === nodeName);
    if (node) {
      if (node.parameters.headerParameters && node.parameters.headerParameters.parameters) {
        node.parameters.headerParameters.parameters.forEach(p => {
          if (p.name === 'Authorization') {
            p.value = `Bearer ${SECURE_WEBHOOK_SECRET}`;
            modified = true;
          }
        });
      }
    }
  });

  if (!modified) {
    console.log('No nodes were modified. Check workflow JSON.');
    return;
  }

  const putRes = await fetch(URL, {
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings })
  });

  if (!putRes.ok) throw new Error('Failed to PUT: ' + await putRes.text());
  console.log('Successfully patched all Billing Nodes to use the Secure Webhook Secret!');
}

run().catch(console.error);
