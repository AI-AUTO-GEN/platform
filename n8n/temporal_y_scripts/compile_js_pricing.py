import json
import re

def parse_pricing_to_math(desc):
    if not desc or desc == "undefined":
        return {"base": 0, "type": "unknown"}

    desc_l = desc.lower()
    
    # 1. Image generation (fixed per generation or per image)
    # E.g. "Your request will cost $0.08 per image."
    # E.g. "Your request will cost $0.75 per generation."
    img_match = re.search(r'\$(\d+\.\d+?)\s+per\s+(image|generation|request)', desc_l)
    if img_match:
        return {"base": float(img_match.group(1)), "type": "fixed", "multipliers": {"2k": 1.5, "4k": 2.0} if "2k" in desc_l else {}}
    
    # E.g. "For $1.00, you can run this model 12 times." -> $1/12 = 0.0833
    time_match = re.search(r'\$(\d+\.\d+).*?(\d+)\s+times', desc_l)
    if time_match and not img_match:
        return {"base": round(float(time_match.group(1)) / float(time_match.group(2)), 4), "type": "fixed"}

    # 2. Megapixel-based
    # E.g. "Requests cost $0.012 per megapixel"
    mp_match = re.search(r'\$(\d+\.\d+)\s+per\s+megapixel', desc_l)
    if mp_match:
        return {"base": float(mp_match.group(1)), "type": "megapixel"}

    # 3. Time-based (video/audio seconds)
    # E.g. "For every second of video you generated, you will be charged $0.112..."
    # E.g. "charged $0.10 without audio"
    # E.g. "$0.05/sec"
    sec_match = re.search(r'\$(\d+\.\d+)[^\d]*?(?:per second|/sec|\/second)', desc_l)
    if sec_match:
        # Check for 720p/1080p splits
        price = float(sec_match.group(1))
        # fallback simple sec logic
        return {"base": price, "type": "duration_sec"}
    
    # E.g. "...you will be charged $0.084 (audio off)"
    audio_match = re.search(r'\$(\d+\.\d+)\s*\(audio off\)', desc_l)
    if audio_match:
        return {"base": float(audio_match.group(1)), "type": "duration_sec"}
    
    # 4. Compute second (GPU)
    # E.g. "$0.00111 per compute second"
    gpu_match = re.search(r'\$(\d+\.\d+)\s+per\s+(compute|gpu)\s+second', desc_l)
    if gpu_match:
        return {"base": float(gpu_match.group(1)), "type": "compute_sec"}

    # 5. Tokens
    if "tokens" in desc_l:
        return {"base": 0.0, "type": "tokens"}

    # Fallback pattern for raw $X.XX matching as fixed
    raw_match = re.search(r'\$(\d+\.\d+)', desc_l)
    if raw_match:
        return {"base": float(raw_match.group(1)), "type": "fixed_inferred"}

    return {"base": 0, "type": "unknown"}

def generate():
    with open("FAL_AI_ALL_PRICING.json", "r", encoding="utf-8") as f:
        models = json.load(f)

    db = {}
    for m in models:
        endpoint = m["id"]
        price_info = m.get("pricingInfoOverride", "")
        db[endpoint] = parse_pricing_to_math(price_info)
        # Store original string for tooltip
        db[endpoint]["desc"] = price_info

    js_code = f"""// AUTO-GENERATED: FAL.AI PRICING DATABASE (From Financial Bible V4)
// Total Models: {len(db)}

export const FAL_PRICING_DB = {json.dumps(db, indent=2, ensure_ascii=False)};
"""
    with open("src/pricing/falPricingDB.js", "w", encoding="utf-8") as out:
        out.write(js_code)

if __name__ == "__main__":
    generate()
    print("falPricingDB.js successfully generated in src/pricing/")
