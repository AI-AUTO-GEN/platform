import re
import json

def generate_financial_bible_v2():
    input_file = "FAL_AI_MODELS_BIBLE.md"
    output_file = "FAL_AI_FINANCIAL_BIBLE.md"
    pricing_file = "FAL_AI_ALL_PRICING.json"

    # Load authentic pricing overrides
    pricing_data = {}
    try:
        with open(pricing_file, "r", encoding="utf-8") as f:
            items = json.load(f)
            for item in items:
                # Store the exact natural language pricing given by the API
                if item.get("pricingInfoOverride"):
                    pricing_data[item["id"]] = item["pricingInfoOverride"]
    except FileNotFoundError:
        print("Pricing JSON not found.")

    with open(input_file, "r", encoding="utf-8") as f:
        content = f.read()

    categories = re.split(r'\n# CATEGORÍA:\s*(.*?)\n', content)
    
    with open(output_file, "w", encoding="utf-8") as out:
        out.write("# 💵 LA BIBLIA FINANCIERA DE FAL.AI — LISTA DE COSTES MATHEMATICOS Y VARIABLES\n\n")
        out.write("> **Documente financer**: Detalla las variables de facturación exacta y las fórmulas de coste subyacentes para todos los modelos de fal.ai.\n")
        out.write("> **NOTA DE ACTUALIZACIÓN**: Se han integrado los precios base exactos consultados desde la API privada de fal.ai.\n\n")
        out.write("---\n\n## 🧾 Explicación Matemática del Pricing de Fal.ai\n")
        out.write("""
Fal.ai utiliza un modelo "Pay-as-you-go" (pago por uso) puro, sin comisiones ocultas, que tarifica basándose estrictamente en el coste computacional medido a través de combinaciones de variables:

1. **Modelos de Imagen (Megapixels & Steps) 🖼️**
   `Coste_Total = (Ancho * Alto / 1,000,000) * Precio_Base_MP * (num_inference_steps / Pasos_Base)`
   *Cualquier aumento en resolución multiplica el coste geométricamente.*

2. **Modelos de Vídeo (Tiempo, Fotogramas & Resolución) 🎞️**
   `Coste_Total = Duración_segundos * (Ancho * Alto / Res_Base) * (FPS / FPS_Base) * Precio_Base_Seg`

3. **Modelos de Audio/Voz (Duración de inferencia) 🎵**
   `Coste_Total = Duración_Audio_Segundos * Precio_Base_Seg`

4. **Modelos LLM/Visión (Tokens) 💬**
   `Coste_Total = (Input_Tokens * P_Input) + (Output_Tokens * P_Output)`

Si un modelo no tiene estas variables expuestas, se cobra una tarifa plana *per-request* o basándose estrictamente en el GPU time *per-second*.

---
""")

        # Process each category
        for i in range(1, len(categories), 2):
            cat_name = categories[i].strip()
            cat_content = categories[i+1]
            out.write(f"\n# CATEGORÍA: {cat_name}\n\n")
            
            models = re.split(r'\n##\s+(fal-ai/[^\n]+)', cat_content)
            
            for j in range(1, len(models), 2):
                endpoint = models[j].strip()
                model_data = models[j+1]
                
                title_match = re.search(r'\*\*Title:\*\*\s*(.+)', model_data)
                title = title_match.group(1) if title_match else endpoint
                
                out.write(f"## {endpoint} ({title})\n")
                
                # Fetch exact base price from our lookup dictionary
                base_price_info = pricing_data.get(endpoint, "Precio base fijo no expuesto públicamente (Sujeto a compute-segundo o token exacto).")

                # Extract Schema for mathematical variables
                schema_match = re.search(r'### 📥 Input Schema:(.*?)(?=\n### 📤|\n##\s+fal-ai|\n# CATEGORÍA|\\Z)', model_data, re.DOTALL)
                
                billing_vars = []
                cost_formula = ""
                
                if schema_match:
                    schema_text = schema_match.group(1)
                    
                    width = re.search(r'- \*\*`width`\*\*.*\n', schema_text)
                    height = re.search(r'- \*\*`height`\*\*.*\n', schema_text)
                    image_size = re.search(r'- \*\*`image_size`\*\*.*\n', schema_text)
                    steps = re.search(r'- \*\*`num_inference_steps`\*\*.*\n', schema_text)
                    duration = re.search(r'- \*\*`(?:video_length|duration|total_seconds|end_time)`\*\*.*\n', schema_text)
                    fps = re.search(r'- \*\*`fps`\*\*.*\n', schema_text)
                    frames = re.search(r'- \*\*`frames`\*\*.*\n', schema_text)
                    tokens = re.search(r'- \*\*`max_tokens`\*\*.*\n', schema_text)

                    if width and height:
                        billing_vars.append("Resolución geométrica (Ancho x Alto)")
                    elif image_size:
                        billing_vars.append("Resolución Mpx (image_size)")
                        
                    if steps:
                        billing_vars.append("Dificultad algorítmica (num_inference_steps)")
                    if duration:
                        billing_vars.append("Duración real (segundos)")
                    elif frames:
                        billing_vars.append("Capacidad temporal (frames)")
                    if fps:
                        billing_vars.append("Densidad temporal (fps)")
                    if tokens:
                        billing_vars.append("Densidad semántica (max_tokens)")
                
                if "Duración real (segundos)" in billing_vars or "Capacidad temporal (frames)" in billing_vars:
                    base_str = "Duracion_Segundos" if "Duración real (segundos)" in billing_vars else "Frames_Totales"
                    res_multiplier = " * Multiplicador_Resolucion(Ancho x Alto)" if "Resolución geométrica (Ancho x Alto)" in billing_vars else ""
                    cost_formula = f"Coste = Precio_Base_Video * {base_str}{res_multiplier}"
                elif "Resolución geométrica (Ancho x Alto)" in billing_vars or "Resolución Mpx (image_size)" in billing_vars:
                    res_str = "(Ancho * Alto / 1M)" if "Resolución geométrica (Ancho x Alto)" in billing_vars else "(image_size en MP)"
                    step_multiplier = " * (num_inference_steps / steps_base)" if "Dificultad algorítmica (num_inference_steps)" in billing_vars else ""
                    cost_formula = f"Coste = Precio_Base_1MP * {res_str}{step_multiplier}"
                elif "Densidad semántica (max_tokens)" in billing_vars:
                    cost_formula = "Coste = (Input_Tokens * P_Input) + (Output_Tokens * P_Output)"
                else:
                    cost_formula = "Coste = Factor de Petición Fija * N"

                if not billing_vars:
                    billing_vars.append("Generación simple sin variables complejas")

                out.write(f"**💰 Coste Base Fal.ai:**\n> {base_price_info}\n\n")
                out.write(f"**📐 Fórmula Matemática Implicada:**\n`{cost_formula}`\n\n")
                out.write("**⚙️ Variables de Coste del Payload JSON:**\n")
                for var in billing_vars:
                    out.write(f"- 🔸 **{var}**\n")
                
                out.write("\n---\n")

generate_financial_bible_v2()
print("Financial Bible V2 Generated Successfully.")
