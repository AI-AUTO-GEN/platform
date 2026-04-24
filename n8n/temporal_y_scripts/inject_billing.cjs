const fs = require('fs');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0NWFhY2NhYS01NTFiLTQ4NjAtYmJkYi00ZjBkZjVmNjFjMzEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWViOTA1M2ItMzYwYi00NDA1LThiZjUtOTcyMzcwOTM0NDU0IiwiaWF0IjoxNzc2ODY2MDg0fQ.oM6YPppDo2I1WOyjxWt8CJ88PidV1NWAoTd6lX49RZ4';
const URL = 'https://nsk404.app.n8n.cloud/api/v1/workflows/fhQyHZy64VscaQ8Q';

async function run() {
  const res = await fetch(URL, { headers: { 'X-N8N-API-KEY': API_KEY } });
  const wf = await res.json();

  // 1. ADD "BILLING HOLD" NODE
  const holdNodeId = 'billing-hold';
  const holdNode = {
    id: holdNodeId,
    name: 'Billing Hold',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4,
    position: [400, 48],
    parameters: {
      method: 'POST',
      url: 'https://nangyrlyayskchsjqymn.supabase.co/functions/v1/renderfarm-billing',
      authentication: 'none',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Authorization', value: '={{ $node["Webhook"].json.headers.authorization }}' }
        ]
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify({ action: "hold", user_id: $node["Restore Payload & Auth"].json._user.id, model_id: $node["Restore Payload & Auth"].json.task.modelId, settings: $node["Restore Payload & Auth"].json.task.settings }) }}',
      options: {}
    }
  };

  // 2. ADD "BILLING LIQUIDATE" NODE
  const liquidateNodeId = 'billing-liquidate';
  const liquidateNode = {
    id: liquidateNodeId,
    name: 'Billing Liquidate',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4,
    position: [2000, 48],
    parameters: {
      method: 'POST',
      url: 'https://nangyrlyayskchsjqymn.supabase.co/functions/v1/renderfarm-billing',
      authentication: 'none',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Authorization', value: '={{ $node["Webhook"].json.headers.authorization }}' }
        ]
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify({ action: "liquidate", transaction_id: $node["Billing Hold"].json.transaction_id, actual_cost: $node["Extract Result"].json.usage.actual_cost }) }}',
      options: {}
    }
  };

  // 3. ADD "BILLING REFUND" NODE
  const refundNodeId = 'billing-refund';
  const refundNode = {
    id: refundNodeId,
    name: 'Billing Refund',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4,
    position: [800, 300], // Below error reporter
    parameters: {
      method: 'POST',
      url: 'https://nangyrlyayskchsjqymn.supabase.co/functions/v1/renderfarm-billing',
      authentication: 'none',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Authorization', value: '={{ $node["Webhook"].json.headers.authorization }}' }
        ]
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify({ action: "refund", transaction_id: $node["Billing Hold"].json.transaction_id }) }}',
      options: {}
    }
  };

  [holdNode, liquidateNode, refundNode].forEach(node => {
    if (!wf.nodes.find(n => n.id === node.id)) {
      wf.nodes.push(node);
    } else {
      Object.assign(wf.nodes.find(n => n.id === node.id), node);
    }
  });

  // Wiring
  
  // A. Action Switch [1] -> Billing Hold
  if (wf.connections['Action Switch'] && wf.connections['Action Switch'].main[1]) {
    const generateTargets = wf.connections['Action Switch'].main[1]; // [Init Telemetry, Format Builder]
    wf.connections['Action Switch'].main[1] = [ { node: 'Billing Hold', type: 'main', index: 0 } ];
    
    wf.connections['Billing Hold'] = {
      main: [ generateTargets ]
    };
  }

  // B. Final Telemetry -> Billing Liquidate
  if (wf.connections['Final Telemetry']) {
    const finalTargets = wf.connections['Final Telemetry'].main[0] || [];
    wf.connections['Final Telemetry'].main[0] = [ { node: 'Billing Liquidate', type: 'main', index: 0 } ];
    
    wf.connections['Billing Liquidate'] = {
      main: [ finalTargets ]
    };
  } else {
    wf.connections['Final Telemetry'] = {
      main: [ [ { node: 'Billing Liquidate', type: 'main', index: 0 } ] ]
    };
  }

  // C. Error Reporter -> Billing Refund
  if (wf.connections['Error Reporter']) {
    const errTargets = wf.connections['Error Reporter'].main[0] || [];
    wf.connections['Error Reporter'].main[0] = [ { node: 'Billing Refund', type: 'main', index: 0 } ];
    
    wf.connections['Billing Refund'] = {
      main: [ errTargets ]
    };
  } else {
    wf.connections['Error Reporter'] = {
      main: [ [ { node: 'Billing Refund', type: 'main', index: 0 } ] ]
    };
  }

  const putRes = await fetch(URL, {
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: { executionOrder: 'v1' } })
  });

  if (!putRes.ok) throw new Error('Failed to PUT: ' + await putRes.text());
  console.log('Successfully injected Billing logic!');
}

run().catch(console.error);
