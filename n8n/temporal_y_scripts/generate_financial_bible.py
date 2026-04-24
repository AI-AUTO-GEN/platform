import re

def generate_financial_bible():
    input_file = "FAL_AI_MODELS_BIBLE.md"
    output_file = "FAL_AI_FINANCIAL_BIBLE.md"

    with open(input_file, "r", encoding="utf-8") as f:
        content = f.read()

    # Split by categories
    categories = re.split(r'\n# CATEGORÍA:\s*(.*?)\n', content)
    
    header = categories[0]
    
    with open(output_file, "w", encoding="utf-8") as out:
        out.write("# 💵 LA BIBLIA FINANCIERA DE FAL.AI — LISTA DE COSTES MATHEMATICOS Y VARIABLES\n\n")
        out.write("> **Documente financer**: Detalla las variables de facturación exacta y las fórmulas de coste subyacentes para todos los modelos de fal.ai.\n")
        out.write("> La facturación de Fal.ai se calcula sobre el uso de recursos brutos (Megapíxeles, Segundos, Tokens y Pasos de Inferencia).\n\n")
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
            
            # Split models within category
            models = re.split(r'\n##\s+(fal-ai/[^\n]+)', cat_content)
            
            for j in range(1, len(models), 2):
                endpoint = models[j].strip()
                model_data = models[j+1]
                
                # Fetch title
                title_match = re.search(r'\*\*Title:\*\*\s*(.+)', model_data)
                title = title_match.group(1) if title_match else endpoint
                
                out.write(f"## {endpoint} ({title})\n")
                
                # Extract Schema
                schema_match = re.search(r'### 📥 Input Schema:(.*?)(?=\n### 📤|\n##\s+fal-ai|\n# CATEGORÍA|\\Z)', model_data, re.DOTALL)
                
                billing_vars = []
                cost_formula = ""
                
                if schema_match:
                    schema_text = schema_match.group(1)
                    
                    # Find potential pricing multipliers
                    width = re.search(r'- \*\*`width`\*\*.*\n', schema_text)
                    height = re.search(r'- \*\*`height`\*\*.*\n', schema_text)
                    image_size = re.search(r'- \*\*`image_size`\*\*.*\n', schema_text)
                    steps = re.search(r'- \*\*`num_inference_steps`\*\*.*\n', schema_text)
                    duration = re.search(r'- \*\*`(?:video_length|duration|total_seconds|end_time)`\*\*.*\n', schema_text)
                    fps = re.search(r'- \*\*`fps`\*\*.*\n', schema_text)
                    frames = re.search(r'- \*\*`frames`\*\*.*\n', schema_text)
                    tokens = re.search(r'- \*\*`max_tokens`\*\*.*\n', schema_text)

                    if width and height:
                        billing_vars.append("Resolución (Ancho x Alto)")
                    elif image_size:
                        billing_vars.append("Resolución (image_size Mpx)")
                        
                    if steps:
                        billing_vars.append("Procesamiento (num_inference_steps)")
                    if duration:
                        billing_vars.append("Duración (segundos)")
                    elif frames:
                        billing_vars.append("Fotogramas totales (frames)")
                    if fps:
                        billing_vars.append("Tasa de Fotogramas (fps)")
                    if tokens:
                        billing_vars.append("Límite de Salida (max_tokens)")
                
                # Determine formula based on vars
                if "Duración (segundos)" in billing_vars or "Fotogramas totales (frames)" in billing_vars:
                    base_str = "Duracion_Segundos" if "Duración (segundos)" in billing_vars else "Frames_Totales"
                    res_multiplier = " * Multiplicador_Resolucion(Ancho x Alto)" if "Resolución (Ancho x Alto)" in billing_vars else ""
                    step_multiplier = " * Factor_Pasos(num_inference_steps)" if "Procesamiento (num_inference_steps)" in billing_vars else ""
                    fps_multiplier = " * Factor_FPS(fps)" if "Tasa de Fotogramas (fps)" in billing_vars else ""
                    cost_formula = f"Coste = Precio_Base_Video * {base_str}{res_multiplier}{step_multiplier}{fps_multiplier}"
                
                elif "Resolución (Ancho x Alto)" in billing_vars or "Resolución (image_size Mpx)" in billing_vars:
                    res_str = "(Ancho * Alto / 1M)" if "Resolución (Ancho x Alto)" in billing_vars else "(image_size en MP)"
                    step_multiplier = " * (num_inference_steps / steps_base)" if "Procesamiento (num_inference_steps)" in billing_vars else ""
                    cost_formula = f"Coste = Precio_Base_1MP * {res_str}{step_multiplier}"
                
                elif "Límite de Salida (max_tokens)" in billing_vars:
                    cost_formula = "Coste = (Input_Tokens * P_Input) + (Output_Tokens * P_Output)"
                    
                else:
                    if "text-to-speech" in cat_name.lower() or "audio" in cat_name.lower():
                        cost_formula = "Coste = Segundos_Generados * Precio_Seg_Audio (Facturación basada en salida generada)"
                    elif "training" in cat_name.lower():
                        cost_formula = "Coste = Horas_GPU_Utilizadas * Precio_GPU_Hora (o precio fijo por run si serverless)"
                    else:
                        cost_formula = "Coste = Tarifa Plana por Per-Request / Iteración (Precio fijo independiente de variables)"

                if not billing_vars:
                    billing_vars.append("Petición simple (Fijo)")

                out.write(f"**Fórmula Matemática de Facturación:**\n`{cost_formula}`\n\n")
                out.write("**Variables de Impacto de Coste detectadas:**\n")
                for var in billing_vars:
                    out.write(f"- 🔸 **{var}**\n")
                
                out.write("\n---\n")

generate_financial_bible()
print("Financial Bible Generated Successfully.")
