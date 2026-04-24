# Higgsfield AI — Models & Technical Architecture
> Audit Date: 2026-04-24

## Multi-Model Aggregation Strategy
Higgsfield's core competitive advantage is being a **model aggregator** — not a single-model tool. They integrate multiple SOTA models into one unified interface.

## Available Models (April 2026)

### Video Generation
| Model | Provider | Resolution | Key Strengths |
|-------|----------|-----------|---------------|
| **Kling 3.0** | Kuaishou | Up to 4K | Top-tier quality, realistic motion |
| **Sora 2** | OpenAI | Up to 1080p | Narrative consistency, physics |
| **Veo 3.1** | Google DeepMind | Up to 1080p | Coherent long-form, high detail |
| **Wan 2.6** | Alibaba | 1080p | Cost-effective, fast |
| **MiniMax Hailuo 02** | MiniMax | 1080p | Strong motion, affordable |
| **Seedance 2.0** | ByteDance | 1080p | Native lip-sync, physics-aware |
| **Soul** | Higgsfield (proprietary) | — | Character identity consistency |
| **Nano Banana Pro** | Higgsfield (proprietary) | — | Fast/cheap drafting model |

### Image Generation
| Model | Provider | Key Strengths |
|-------|----------|---------------|
| **GPT Image 2** | OpenAI | High-fidelity image gen |
| **Seedream v4** | ByteDance | Text-to-image, high quality |
| Various integrated | Multiple | Available through Apps |

### Post-Production Models
| Tool | Function |
|------|----------|
| **Higgsfield Upscale** | Frame-by-frame reconstruction up to 4K/8K |
| **Higgsfield Enhancer** | De-flicker, stabilize, temporal coherence |
| **Lipsync Studio** | Image + script/audio → talking head video |
| **Higgsfield Audio** | TTS, voice cloning, voice swap, 70+ language translation |

## Proprietary Technology

### Soul ID (Character Consistency)
- **Training:** Upload 10–20 high-quality photos from different angles
- **Output:** Locked facial features, hair, identity
- **Persistence:** Consistent across styles, poses, lighting, scenes
- **Use Cases:** Episodic content, brand personas, AI influencers
- **Version:** Soul 2.0

### Mr. Higgs (AI Co-Director)
- Breaks scenes into shots
- Manages technical settings (camera, lens)
- Populates prompts for consistency
- Ensures visual/stylistic cohesion across shots

## API Architecture

### Authentication
```
Authorization: Bearer <API_KEY>
```
Or environment variables:
```
HF_KEY="your-api-key:your-api-secret"
HF_API_KEY="your-api-key"
HF_API_SECRET="your-api-secret"
```

### API Pattern (RESTful)
1. **Submit:** POST `/v1/generations` with model, prompt, input_data
2. **Poll:** GET `/v2/requests/status/{request_id}`
3. **Retrieve:** Result URL in completed response

### Status States
- `Queued` → `InProgress` → `Completed`
- Error states: `Failed`, `NSFW`, `Cancelled`

### SDK Support
- **Python:** `pip install higgsfield-client` (sync + async)
- **Node.js/TypeScript:** `higgsfield-js`
- **Cloud Dashboard:** cloud.higgsfield.ai

### SDK Patterns
1. **subscribe()** — Submit and block until result
2. **submit() + poll_request_status()** — Submit and track progress
3. **subscribe() with callbacks** — Event-driven (on_enqueue, on_queue_update)
4. **File uploads** — upload(), upload_file(), upload_image() (+ async variants)

## Open Source Repos

| Repo | Stars | Description | License |
|------|-------|-------------|---------|
| `higgsfield-ai/higgsfield` | 3.6k ⭐ | GPU orchestration framework for trillion-parameter model training | Apache 2.0 |
| `higgsfield-ai/higgsfield-client` | 36 ⭐ | Python SDK for API | Apache 2.0 |
| `higgsfield-ai/higgsfield-js` | — | Node.js/TypeScript SDK | Apache 2.0 |

### GPU Framework Details
- Fault-tolerant, highly scalable GPU orchestration
- ZeRO-3 DeepSpeed + PyTorch FSDP support
- Experiment queue management
- GitHub Actions CI/CD integration
- Compatible with: Azure, LambdaLabs, FluidStack
- Languages: Jupyter Notebook 82.3%, Python 16.2%, Jinja 1.5%
