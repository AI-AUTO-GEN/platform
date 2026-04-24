import json

# read workflow
with open('f:\\NSK - PROJECTS\\AI AUTO GEN\\n8n_latest_workflow.json', 'r', encoding='utf-16') as f:
    wf = json.load(f)

# we will create a new node for uploading WebP to Supabase
supabase_upload_node = {
    "parameters": {
        "method": "POST",
        "url": "={{ 'https://nangyrlyayskchsjqymn.supabase.co/storage/v1/object/assets/' + $node['Format Builder'].json.fileName + '.webp' }}",
        "sendHeaders": True,
        "headerParameters": {
            "parameters": [
                {
                    "name": "Authorization",
                    "value": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hbmd5cmx5YXlza2Noc2pxeW1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxODk2OTksImV4cCI6MjA5MTc2NTY5OX0.EgRAIjDwd959i1kjZybwadN9gSRsd7Qyk6xixrhq6j0"
                },
                {
                    "name": "Content-Type",
                    "value": "image/webp"
                }
            ]
        },
        "sendBody": True,
        "specifyBody": "binary",
        "inputDataFieldName": "data"
    },
    "id": "upload-webp-supabase",
    "name": "Upload WebP to Supabase Storage",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4,
    "position": [
        1800,
        200
    ]
}

# Add node
wf['nodes'].append(supabase_upload_node)

# Current issue: 'Fork: Dual Storage' connects to Upload HQ and Switch.
# Let's fix Final Telemetry to wait for BOTH streams?
# 'Final Telemetry' is type "n8n-nodes-base.supabase". 
# But wait, to avoid multiple executions, we can sequentialize:
# Upload HQ [1400] -> Switch Asset Type [1600]
# From Switch [index 0] -> Optimize WebP -> Upload WebP to Supabase Storage -> Final Telemetry
# Wait! IF it is a video (index 1), Switch Asset Type -> Final Telemetry.
# This prevents parallel diverging and merging.

# Let's fix the connections:
new_connections = {
    "Webhook": {
        "main": [[{"node": "Init Telemetry", "type": "main", "index": 0}]]
    },
    "Init Telemetry": {
        "main": [[{"node": "Format Builder", "type": "main", "index": 0}]]
    },
    "Format Builder": {
        "main": [[{"node": "Telemetry Generating", "type": "main", "index": 0}]]
    },
    "Telemetry Generating": {
        "main": [[{"node": "FAL.AI Engine", "type": "main", "index": 0}]]
    },
    "FAL.AI Engine": {
        "main": [[{"node": "Extract Result", "type": "main", "index": 0}]]
    },
    "Extract Result": {
        "main": [[{"node": "Telemetry Downloading", "type": "main", "index": 0}]]
    },
    "Telemetry Downloading": {
        "main": [[{"node": "Download HQ Binary", "type": "main", "index": 0}]]
    },
    "Download HQ Binary": {
        # Sequentialize instead of Fork
        "main": [[{"node": "Upload HQ to Drive", "type": "main", "index": 0}]]
    },
    "Upload HQ to Drive": {
        "main": [[{"node": "Switch Asset Type", "type": "main", "index": 0}]]
    },
    "Switch Asset Type": {
        "main": [
            [{"node": "Optimize WebP", "type": "main", "index": 0}], # If not video, go here
            [{"node": "Final Telemetry", "type": "main", "index": 0}] # If video, directly to telemetry
        ]
    },
    "Optimize WebP": {
        "main": [[{"node": "Upload WebP to Supabase Storage", "type": "main", "index": 0}]]
    },
    "Upload WebP to Supabase Storage": {
        "main": [[{"node": "Final Telemetry", "type": "main", "index": 0}]]
    }
}

# Switch node evaluates condition over $json.kind, but after "Upload HQ to Drive", $json loses properties!
# So we update the Switch node to use $node["Format Builder"].json.kind instead of $json.kind!
for n in wf['nodes']:
    if n['name'] == 'Switch Asset Type':
        n['parameters']['rules']['rules'][0]['conditions']['string'][0]['value1'] = '={{ $node["Format Builder"].json.kind }}'
        if len(n['parameters']['rules']['rules']) > 1:
            n['parameters']['rules']['rules'][1]['conditions']['string'][0]['value1'] = '={{ $node["Format Builder"].json.kind }}'
    
    # Update Final Telemetry to capture the thumbnail URL if WebP was uploaded
    if n['name'] == 'Final Telemetry':
        # we will add the thumbnail_url field to fieldValues
        found_thumbnail = False
        for f in n['parameters']['fieldsUi']['fieldValues']:
            if f['fieldId'] == 'thumbnail_url':
                f['fieldValue'] = "={{ $node[\"Format Builder\"].json.kind.includes('v') ? $node[\"Upload HQ to Drive\"].json.webViewLink : 'https://nangyrlyayskchsjqymn.supabase.co/storage/v1/object/public/assets/' + $node[\"Format Builder\"].json.fileName + '.webp' }}"
                found_thumbnail = True
                
        if not found_thumbnail:
            n['parameters']['fieldsUi']['fieldValues'].append({
                "fieldId": "thumbnail_url",
                "fieldValue": "={{ $node[\"Format Builder\"].json.kind.includes('v') ? $node[\"Upload HQ to Drive\"].json.webViewLink : 'https://nangyrlyayskchsjqymn.supabase.co/storage/v1/object/public/assets/' + $node[\"Format Builder\"].json.fileName + '.webp' }}"
            })

wf['connections'] = new_connections

# Update positions for sequential view
pos_x = 0
positions = {
    "Webhook": 0,
    "Init Telemetry": 200,
    "Format Builder": 400,
    "Telemetry Generating": 600,
    "FAL.AI Engine": 800,
    "Extract Result": 1000,
    "Telemetry Downloading": 1200,
    "Download HQ Binary": 1400,
    "Upload HQ to Drive": 1600,
    "Switch Asset Type": 1800,
    "Optimize WebP": 2000,
    "Upload WebP to Supabase Storage": 2200,
    "Final Telemetry": 2400
}

# Cleanup old unused nodes like "Fork: Dual Storage" and "Merge Opt"
wf['nodes'] = [n for n in wf['nodes'] if n['name'] not in ["Fork: Dual Storage", "Merge Opt"]]

for n in wf['nodes']:
    if n['name'] in positions:
        n['position'] = [positions[n['name']], 0]
        if n['name'] == 'Final Telemetry':
            n['position'] = [2400, 100]

with open('f:\\NSK - PROJECTS\\AI AUTO GEN\\n8n_patched_workflow.json', 'w') as f:
    json.dump(wf, f, indent=2)

print("Patched!")
