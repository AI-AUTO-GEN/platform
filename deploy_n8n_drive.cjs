const fs = require('fs');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0NWFhY2NhYS01NTFiLTQ4NjAtYmJkYi00ZjBkZjVmNjFjMzEiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiYWViOTA1M2ItMzYwYi00NDA1LThiZjUtOTcyMzcwOTM0NDU0IiwiaWF0IjoxNzc2ODY2MDg0fQ.oM6YPppDo2I1WOyjxWt8CJ88PidV1NWAoTd6lX49RZ4';
const N8N_URL = 'https://nsk404.app.n8n.cloud/api/v1/workflows';

const DRIVE_CRED_ID = 'vcK90pZBlKAYi3NY';

const orchestrator_workflow = {
  name: "DRIVE_ORCHESTRATOR",
  active: true,
  nodes: [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "drive-upload",
        "responseMode": "lastNode",
        "options": {}
      },
      "id": "webhook-upload",
      "name": "Webhook Upload",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [0, 0]
    },
    {
      "parameters": {
        "operation": "upload",
        "fileContent": "={{$binary.data}}",
        "name": "={{$binary.data.fileName}}",
        "parents": ["My Drive"] // In a real setup, we should search for Project Folder and append it here.
      },
      "id": "drive-upload",
      "name": "Google Drive Upload",
      "type": "n8n-nodes-base.googleDrive",
      "typeVersion": 3,
      "position": [200, 0],
      "credentials": {
        "googleDriveOAuth2Api": {
          "id": DRIVE_CRED_ID,
          "name": "Google Drive account"
        }
      }
    },
    {
      "parameters": {
        "keepOnlySet": false,
        "values": {
          "string": [
            {
              "name": "hq_url",
              "value": "={{ $json.webViewLink }}"
            },
            {
              "name": "ui_url",
              "value": "={{ $json.webViewLink }}" // Fallback to Drive link for UI for now, until Supabase Compression is fully integrated
            }
          ]
        },
        "options": {}
      },
      "id": "set-urls",
      "name": "Set URLs",
      "type": "n8n-nodes-base.set",
      "typeVersion": 1,
      "position": [400, 0]
    },
    
    // --- EXPORT PATH ---
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "export-project",
        "responseMode": "onReceived",
        "responseCode": 200,
        "options": {}
      },
      "id": "webhook-export",
      "name": "Webhook Export",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [0, 200]
    },
    {
      "parameters": {
        "operation": "create",
        "binaryPropertyName": "data",
        "fileName": "={{$json.body.projectName}}_{{$json.body.section}}.zip"
      },
      "id": "compress-zip",
      "name": "Compression",
      "type": "n8n-nodes-base.compression",
      "typeVersion": 1,
      "position": [200, 200]
    },
    {
      "parameters": {
        "operation": "upload",
        "fileContent": "={{$binary.data}}",
        "name": "={{$binary.data.fileName}}",
        "parents": ["My Drive"]
      },
      "id": "drive-upload-zip",
      "name": "Google Drive Upload ZIP",
      "type": "n8n-nodes-base.googleDrive",
      "typeVersion": 3,
      "position": [400, 200],
      "credentials": {
        "googleDriveOAuth2Api": {
          "id": DRIVE_CRED_ID,
          "name": "Google Drive account"
        }
      }
    },
    {
      "parameters": {
        "method": "PATCH",
        "url": "={{ 'https://nangyrlyayskchsjqymn.supabase.co/rest/v1/projects?name=eq.' + $node['Webhook Export'].json.body.projectName }}",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Authorization",
              "value": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hbmd5cmx5YXlza2Noc2pxeW1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxODk2OTksImV4cCI6MjA5MTc2NTY5OX0.EgRAIjDwd959i1kjZybwadN9gSRsd7Qyk6xixrhq6j0"
            },
            {
              "name": "apikey",
              "value": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hbmd5cmx5YXlza2Noc2pxeW1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxODk2OTksImV4cCI6MjA5MTc2NTY5OX0.EgRAIjDwd959i1kjZybwadN9gSRsd7Qyk6xixrhq6j0"
            },
            {
              "name": "Content-Type",
              "value": "application/json"
            }
          ]
        },
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {
              "name": "export_url",
              "value": "={{ $json.webViewLink }}"
            }
          ]
        },
        "options": {}
      },
      "id": "update-supabase",
      "name": "Update Supabase",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4,
      "position": [600, 200]
    }
  ],
  connections: {
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
  }
};

async function run() {
  console.log("Deploying workflow to N8N...");
  const res = await fetch(N8N_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': API_KEY
    },
    body: JSON.stringify(orchestrator_workflow)
  });
  
  if (!res.ok) {
    console.error("Deploy failed:", await res.text());
  } else {
    const data = await res.json();
    console.log("Successfully deployed DRIVE_ORCHESTRATOR!");
    console.log("Workflow ID:", data.id);
  }
}

run();
