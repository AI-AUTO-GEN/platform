const fs = require('fs');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0NWFhY2NhYS01NTFiLTQ4NjAtYmJkYi00ZjBkZjVmNjFjMzEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWViOTA1M2ItMzYwYi00NDA1LThiZjUtOTcyMzcwOTM0NDU0IiwiaWF0IjoxNzc2ODY2MDg0fQ.oM6YPppDo2I1WOyjxWt8CJ88PidV1NWAoTd6lX49RZ4';
const URL = 'https://nsk404.app.n8n.cloud/api/v1/workflows/fhQyHZy64VscaQ8Q';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hbmd5cmx5YXlza2Noc2pxeW1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxODk2OTksImV4cCI6MjA5MTc2NTY5OX0.EgRAIjDwd959i1kjZybwadN9gSRsd7Qyk6xixrhq6j0';

async function run() {
  const res = await fetch(URL, { headers: { 'X-N8N-API-KEY': API_KEY } });
  const wf = await res.json();

  const validateNode = wf.nodes.find(n => n.name === 'Validate JWT via Supabase');
  if (validateNode) {
    validateNode.parameters.headerParameters.parameters.forEach(p => {
      if (p.name === 'apikey') {
        p.value = SUPABASE_ANON_KEY;
      }
    });
  }

  const putRes = await fetch(URL, {
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: { executionOrder: 'v1' } })
  });

  if (!putRes.ok) throw new Error('Failed to PUT: ' + await putRes.text());
  console.log('Successfully fixed JWT node!');
}

run().catch(console.error);
