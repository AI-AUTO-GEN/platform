import json
import re

def parse_formula(desc):
    desc_l = desc.lower()
    variables = []
    formula = "Coste = Petición Simple (Tarifa Plana)"
    
    if "megapixel" in desc_l:
        variables.append("Resolución geométrica (Ancho x Alto)")
        formula = "Coste = (Ancho * Alto / 1,000,000) * Precio_Base_MP"
    elif "second of video" in desc_l or "second of " in desc_l or "/second" in desc_l:
        variables.append("Duración temporal (Segundos)")
        formula = "Coste = Segundos * Precio_Base_Seg_Video"
        if "720p" in desc_l or "1080p" in desc_l:
            variables.append("Escalado por Resolución (Ej: 720p vs 1080p)")
            formula += " * Factor_Resol_Calidad"
    elif "compute second" in desc_l or "gpu second" in desc_l:
        variables.append("Tiempo real de inferencia GPU (Segundos)")
        formula = "Coste = Segundos_Computo * Precio_Base_Seg_GPU"
    elif "tokens" in desc_l:
        variables.append("Límite de Salida (Output Tokens) y Entrada (Input Tokens)")
        formula = "Coste = (Input_Tokens * P_In) + (Output_Tokens * P_Out)"
    elif "per image" in desc_l:
        variables.append("Cantidad de imágenes solicitadas (Generaciones)")
        formula = "Coste = N_Imagenes * Precio_Base_Imagen"
        if "2k" in desc_l or "4k" in desc_l:
            variables.append("Factor de resolución (2K=1.5x, 4K=2x)")
            formula += " * Factor_Multiplicador_Resolucion"
    elif "per minute" in desc_l:
        variables.append("Duración (Minutos)")
        formula = "Coste = Minutos * Precio_Base_Minuto"
    else:
        variables.append("N/D (Petición Fija o Determinada por plataforma)")
        formula = "Coste = Precio Estándar"
        
    return formula, variables

def generate():
    with open("FAL_AI_ALL_PRICING.json", "r", encoding="utf-8") as f:
        models = json.load(f)

    # Group models by category
    categories = {}
    for m in models:
        cat = m.get("category", "Uncategorized")
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(m)

    with open("FAL_AI_FINANCIAL_BIBLE.md", "w", encoding="utf-8") as out:
        out.write("# 💵 LA BIBLIA FINANCIERA DE FAL.AI (1312 MODELOS) — MAPA DE PRECIOS EXACTOS\n\n")
        out.write("> **Documento financiero maestro**: Describe los costes, precios base exactos («Pricing Info Override») y el cálculo subyacente para los todos los modelos habilitados en la plataforma.\n\n")
        out.write("---\n\n")

        for cat, ms in sorted(categories.items()):
            out.write(f"\n# CATEGORÍA: {cat.upper()}\n\n")
            
            # Sort by ID
            ms_sorted = sorted(ms, key=lambda x: x["id"])
            
            for m in ms_sorted:
                endpoint = m["id"]
                title = m.get("title", endpoint)
                price_info = m.get("pricingInfoOverride")
                
                # Extract description
                if price_info is None or price_info.strip() == "" or price_info == "undefined":
                    price_info = "Precios base dinámicos bajo demanda (El modelo no tiene override público documentado)."
                
                formula, variables = parse_formula(price_info)
                
                out.write(f"## {endpoint} ({title})\n")
                out.write(f"**💰 Coste Base Fal.ai:**\n> {price_info}\n\n")
                out.write(f"**📐 Fórmula Matemática Implicada:**\n`{formula}`\n\n")
                out.write("**⚙️ Variables de Coste Impactadas:**\n")
                for var in variables:
                    out.write(f"- 🔸 **{var}**\n")
                out.write("\n---\n")

if __name__ == "__main__":
    generate()
    print("V3 Generated with 1312 Models!")
