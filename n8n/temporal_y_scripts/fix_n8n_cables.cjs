const fs = require('fs');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0NWFhY2NhYS01NTFiLTQ4NjAtYmJkYi00ZjBkZjVmNjFjMzEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWViOTA1M2ItMzYwYi00NDA1LThiZjUtOTcyMzcwOTM0NDU0IiwiaWF0IjoxNzc2ODY2MDg0fQ.oM6YPppDo2I1WOyjxWt8CJ88PidV1NWAoTd6lX49RZ4';
const N8N_URL = 'https://nsk404.app.n8n.cloud/api/v1/workflows/FeduhoaWOeTF5GMy';

async function run() {
  console.log("Fetching workflow to correct connections...");
  const res = await fetch(N8N_URL, { headers: { 'X-N8N-API-KEY': API_KEY } });
  const wf = await res.json();
  
  // Replace connections with correct names
  wf.connections = {
    "Webhook Upload": {
      "main": [
        [
          {
            "node": "Google Drive Upload",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Google Drive Upload": {
      "main": [
        [
          {
            "node": "Set URLs",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Webhook Export": {
      "main": [
        [
          {
            "node": "Compression",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Compression": {
      "main": [
        [
          {
            "node": "Google Drive Upload ZIP",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Google Drive Upload ZIP": {
      "main": [
        [
          {
            "node": "Update Supabase",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  };

  console.log("Updating workflow...");
  const putRes = await fetch(N8N_URL, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': API_KEY
    },
    body: JSON.stringify({
      name: wf.name || "DRIVE_ORCHESTRATOR",
      nodes: wf.nodes,
      connections: wf.connections,
      settings: {}
    })
  });
  
  if (!putRes.ok) {
    console.error("Deploy failed:", await putRes.text());
  } else {
    console.log("Successfully fixed cables!");
  }
}

run();
