import json

with open("f:\\NSK - PROJECTS\\AI AUTO GEN\\n8n_latest_workflow.json", "r", encoding="utf-16") as f:
    wf = json.load(f)

for node in wf["nodes"]:
    if node["name"] == "Format Builder":
        # Replace $json.body with $node["Webhook"].json.body
        code = node["parameters"]["jsCode"]
        code = code.replace("const task = $json.body.task;", "const task = $node[\"Webhook\"].json.body.task;")
        code = code.replace("const proj = $json.body.project;", "const proj = $node[\"Webhook\"].json.body.project;")
        node["parameters"]["jsCode"] = code

# Wire the connections properly so it is exactly as the user wants and as the screenshot implies
# The user's screenshot has: Webhook -> Init Telemetry -> Format Builder -> Telemetry Generating -> FAL.AI Engine -> Extract Result -> Telemetry Downloading -> Download HQ Binary -> Upload HQ to Drive -> Switch Asset Type -> Optimize WebP -> Upload WebP to Supabase -> Final Telemetry
wf["connections"] = {
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
        "main": [[{"node": "Upload HQ to Drive", "type": "main", "index": 0}]]
    },
    "Upload HQ to Drive": {
        "main": [[{"node": "Switch Asset Type", "type": "main", "index": 0}]]
    },
    "Switch Asset Type": {
        "main": [
            [{"node": "Optimize WebP", "type": "main", "index": 0}], # index 0 is non-video
            [{"node": "Final Telemetry", "type": "main", "index": 0}] # index 1 is video
        ]
    },
    "Optimize WebP": {
        "main": [[{"node": "Upload WebP to Supabase Storage", "type": "main", "index": 0}]]
    },
    "Upload WebP to Supabase Storage": {
        "main": [[{"node": "Final Telemetry", "type": "main", "index": 0}]]
    }
}

# Remove unused nodes just in case
wf["nodes"] = [n for n in wf["nodes"] if n["name"] not in ["Fork: Dual Storage", "Merge Opt"]]

with open("f:\\NSK - PROJECTS\\AI AUTO GEN\\n8n_latest_workflow.json", "w", encoding="utf-16") as f:
    json.dump(wf, f, indent=2)

print("Workflow configured!")
