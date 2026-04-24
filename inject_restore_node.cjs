const fs = require('fs');
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0NWFhY2NhYS01NTFiLTQ4NjAtYmJkYi00ZjBkZjVmNjFjMzEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWViOTA1M2ItMzYwYi00NDA1LThiZjUtOTcyMzcwOTM0NDU0IiwiaWF0IjoxNzc2ODY2MDg0fQ.oM6YPppDo2I1WOyjxWt8CJ88PidV1NWAoTd6lX49RZ4';
const URL = 'https://nsk404.app.n8n.cloud/api/v1/workflows/fhQyHZy64VscaQ8Q';

async function run() {
  const res = await fetch(URL, { headers: { 'X-N8N-API-KEY': API_KEY } });
  const wf = await res.json();

  const restoreNodeId = 'restore-billing-payload';
  const restoreNode = {
    id: restoreNodeId,
    name: 'Restore Billing Payload',
    type: 'n8n-nodes-base.set',
    typeVersion: 3.2,
    position: [600, 48],
    parameters: {
      options: {},
      keepOnlySet: true,
      assignments: {
        assignments: [
          {
            id: '1',
            name: '',
            value: '={{ $node["Restore Payload & Auth"].json }}',
            type: 'object'
          }
        ]
      }
    }
  };

  if (!wf.nodes.find(n => n.id === restoreNode.id)) {
    wf.nodes.push(restoreNode);
  } else {
    Object.assign(wf.nodes.find(n => n.id === restoreNode.id), restoreNode);
  }

  // Wiring: Billing Hold -> Restore Billing Payload -> [Init Telemetry, Format Builder]
  if (wf.connections['Billing Hold']) {
    const targets = wf.connections['Billing Hold'].main[0];
    wf.connections['Billing Hold'].main[0] = [ { node: 'Restore Billing Payload', type: 'main', index: 0 } ];
    
    wf.connections['Restore Billing Payload'] = {
      main: [ targets ]
    };
  }

  const putRes = await fetch(URL, {
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: { executionOrder: 'v1' } })
  });

  if (!putRes.ok) throw new Error('Failed to PUT: ' + await putRes.text());
  console.log('Successfully injected Restore Billing Payload node!');
}

run().catch(console.error);
