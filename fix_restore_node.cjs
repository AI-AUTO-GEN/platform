const fs = require('fs');
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0NWFhY2NhYS01NTFiLTQ4NjAtYmJkYi00ZjBkZjVmNjFjMzEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWViOTA1M2ItMzYwYi00NDA1LThiZjUtOTcyMzcwOTM0NDU0IiwiaWF0IjoxNzc2ODY2MDg0fQ.oM6YPppDo2I1WOyjxWt8CJ88PidV1NWAoTd6lX49RZ4';
const URL = 'https://nsk404.app.n8n.cloud/api/v1/workflows/fhQyHZy64VscaQ8Q';

async function run() {
  const res = await fetch(URL, { headers: { 'X-N8N-API-KEY': API_KEY } });
  const wf = await res.json();

  const restoreNode = wf.nodes.find(n => n.name === 'Restore Billing Payload');
  if (restoreNode) {
    restoreNode.type = 'n8n-nodes-base.code';
    restoreNode.typeVersion = 2;
    restoreNode.parameters = {
      language: 'javaScript',
      jsCode: `return [{ json: $node['Restore Payload & Auth'].json }];`
    };
  }

  const putRes = await fetch(URL, {
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: { executionOrder: 'v1' } })
  });

  if (!putRes.ok) throw new Error('Failed to PUT: ' + await putRes.text());
  console.log('Successfully fixed Restore Billing Payload node to be a Code node!');
}

run().catch(console.error);
