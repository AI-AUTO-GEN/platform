# Higgsfield AI — API Reference (Python SDK)
> Audit Date: 2026-04-24 | Source: github.com/higgsfield-ai/higgsfield-client

## Installation
```bash
pip install higgsfield-client
```

## Authentication
```bash
# Option 1: Combined key
export HF_KEY="your-api-key:your-api-secret"

# Option 2: Separate
export HF_API_KEY="your-api-key"
export HF_API_SECRET="your-api-secret"
```

Credentials from: https://cloud.higgsfield.ai/

## Usage Patterns

### Pattern 1: Subscribe (Submit + Wait)
```python
import higgsfield_client

result = higgsfield_client.subscribe(
    'bytedance/seedream/v4/text-to-image',
    arguments={
        'prompt': 'A serene lake at sunset with mountains',
        'resolution': '2K',
        'aspect_ratio': '16:9',
        'camera_fixed': False
    }
)
print(result['images'][0]['url'])
```

### Pattern 2: Submit + Poll Status
```python
import higgsfield_client

controller = higgsfield_client.submit(
    'bytedance/seedream/v4/text-to-image',
    arguments={...},
    webhook_url='https://example.com/webhook'  # Optional
)

for status in controller.poll_request_status():
    if isinstance(status, higgsfield_client.Queued):
        print('Queued')
    elif isinstance(status, higgsfield_client.InProgress):
        print('In progress')
    elif isinstance(status, higgsfield_client.Completed):
        print('Completed')
    elif isinstance(status, (higgsfield_client.Failed, 
                              higgsfield_client.NSFW, 
                              higgsfield_client.Cancelled)):
        print('Error')

result = controller.get()
```

### Pattern 3: Callbacks
```python
import higgsfield_client

def on_enqueue(request_id):
    print(f'Request {request_id} enqueued')

def on_status_update(status):
    print(f'Status: {status}')

result = higgsfield_client.subscribe(
    'bytedance/seedream/v4/text-to-image',
    arguments={...},
    on_enqueue=on_enqueue,
    on_queue_update=on_status_update
)
```

### Request Management
```python
# Check status by ID
status = higgsfield_client.status(
    request_id='cdbe9381-e617-438f-ac99-b18eb52a05a0'
)

# Get result by ID
result = higgsfield_client.result(
    request_id='cdbe9381-e617-438f-ac99-b18eb52a05a0'
)

# Cancel request
higgsfield_client.cancel(
    request_id='cdbe9381-e617-438f-ac99-b18eb52a05a0'
)
```

## File Uploads

```python
# Raw bytes
url = higgsfield_client.upload(data, 'image/jpeg')

# File path
url = higgsfield_client.upload_file('path/to/image.jpeg')

# PIL Image
from PIL import Image
img = Image.open('example.jpeg')
url = higgsfield_client.upload_image(img, format='jpeg')
```

## Async Variants
All methods have `_async` suffix:
- `subscribe_async()`
- `submit_async()`
- `status_async()`
- `result_async()`
- `cancel_async()`
- `upload_async()`
- `upload_file_async()`
- `upload_image_async()`

## Model Identifier Format
Models follow vendor/product/version/task pattern:
```
bytedance/seedream/v4/text-to-image
```

## Status States
| Class | Meaning |
|-------|---------|
| `Queued` | Request in queue |
| `InProgress` | Currently generating |
| `Completed` | Done, result available |
| `Failed` | Generation failed |
| `NSFW` | Content flagged |
| `Cancelled` | User cancelled |

## REST API Endpoints (Inferred)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/v1/generations` | Submit generation |
| GET | `/v2/requests/status/{id}` | Check status |
| POST | `/upload` | File upload |
| DELETE | `/v1/requests/{id}` | Cancel request |

## Webhook Support
```python
controller = higgsfield_client.submit(
    model,
    arguments={...},
    webhook_url='https://your-server.com/webhook'
)
```
Webhook fires on completion with result payload.
