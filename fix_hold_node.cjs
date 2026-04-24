const fs = require('fs');
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0NWFhY2NhYS01NTFiLTQ4NjAtYmJkYi00ZjBkZjVmNjFjMzEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWViOTA1M2ItMzYwYi00NDA1LThiZjUtOTcyMzcwOTM0NDU0IiwiaWF0IjoxNzc2ODY2MDg0fQ.oM6YPppDo2I1WOyjxWt8CJ88PidV1NWAoTd6lX49RZ4';
const URL = 'https://nsk404.app.n8n.cloud/api/v1/workflows/fhQyHZy64VscaQ8Q';

async function run() {
  const res = await fetch(URL, { headers: { 'X-N8N-API-KEY': API_KEY } });
  const wf = await res.json();

  const holdNode = wf.nodes.find(n => n.name === 'Billing Hold');
  if (holdNode) {
    holdNode.parameters.options = holdNode.parameters.options || {};
    holdNode.parameters.options.response = { response: { responseData: 'inProperty', responsePropertyName: 'billing' } };
    // Wait! In v4 of HttpRequest, the option is `response: { response: { responseData: 'inProperty', responsePropertyName: 'billing' } }` or just `responseData: 'inProperty'` in options?
    // Let's use `options: { response: { response: { responseData: 'inProperty', responsePropertyName: 'billing_response' } } }`
    // Actually, in n8n-nodes-base.httpRequest v4, it is `options: { response: { response: { responseData: 'inProperty', responsePropertyName: 'billing_response' } } }`
  }

  const liquidateNode = wf.nodes.find(n => n.name === 'Billing Liquidate');
  if (liquidateNode) {
    // If liquidate references $node["Billing Hold"].json.transaction_id it will fail because now it's inside `billing_response`!
    liquidateNode.parameters.jsonBody = '={{ JSON.stringify({ action: "liquidate", transaction_id: $node["Billing Hold"].json.billing_response.transaction_id, actual_cost: $node["Extract Result"].json.usage.actual_cost }) }}';
  }
  
  const refundNode = wf.nodes.find(n => n.name === 'Billing Refund');
  if (refundNode) {
    refundNode.parameters.jsonBody = '={{ JSON.stringify({ action: "refund", transaction_id: $node["Billing Hold"].json.billing_response.transaction_id }) }}';
  }

  const putRes = await fetch(URL, {
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: { executionOrder: 'v1' } })
  });

  if (!putRes.ok) throw new Error('Failed to PUT: ' + await putRes.text());
  console.log('Successfully fixed Billing Hold node!');
}

run().catch(console.error);
