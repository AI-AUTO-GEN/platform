# MIDNIGHT GLASS - SYSTEM CONTEXT PROVIDER

## 1. OBJETIVO GLOBAL DEL PROYECTO
El proyecto "Midnight Glass" (o AI Auto Gen) es un "Renderfarm" de Inteligencia Artificial. Su propósito principal es ofrecer una interfaz gráfica hiper-optimizada (estética Glassmorphism oscuro) donde los usuarios pueden interactuar con un lienzo de nodos. Desde estos nodos, los usuarios envían peticiones (prompts y configuraciones dinámicas) a múltiples modelos de IA (FAL.ai, Kling, Luma, Hunyuan, etc.) para generar imágenes y videos de alta calidad (HQ), y posteriormente descargarlos o visualizarlos directamente en la web.

El ecosistema está fragmentado en tres pilares arquitectónicos:
1. **Frontend:** React (Vite) para la UI/UX y la lógica de interacción de nodos.
2. **Backend / Middleware Orchestrator:** n8n para lidiar con APIs externas y procesos paralelos.
3. **Database / State Manager:** Supabase como fuente de la verdad, telemetría y base de datos en tiempo real.

---

## 2. ARQUITECTURA DETALLADA Y PLATAFORMAS

### 2.1. FRONTEND (React / Web UI)
- **Propósito:** Ser el control central del usuario. Ofrece un lienzo infinito (Canvas) donde existen nodos. Cada nodo es un "Asset" o "Generación" que el usuario puede solicitar.
- **Componentes Clave:**
  - `NodeCanvas.jsx`: Se encarga del drag-and-drop de los nodos y de los controles ("Dropdowns" dinámicos según el modelo elegido para configurar `aspect_ratio`, `resolution`, etc.).
  - `App.jsx`: Contiene la lógica principal, menús y utilidades (`getModelOptions`).
  - **Interacción de Generación:** Al darle a "Generate", el frontend hace un POST al webhook de n8n con el `taskId`, `prompt`, `modelId` y los `settings` del usuario (los overrides).
  - **Polling:** Una vez desencadenada la generación, el frontend lee periódicamente la tabla `renderfarm_outputs` de Supabase para ver cómo avanza el `progress` y el `status_message`, actualizando el % de progreso visualmente en los propios nodos de la web hasta llegar al 100%.

### 2.2. DATABASE & STORAGE (Supabase)
- **Propósito:** Evitar la pérdida de estado y servir como puente de comunicación (Telemetría) entre n8n (que hace el trabajo pesado en background) y el frontend (que solo observa y muestra).
- **Tabla Principal:** `renderfarm_outputs`.
  - Columnas clave: `task_id` (UUID), `status` (pending, ready, etc.), `progress` (0 a 100), `status_message` ("Summoning...", "Downloading..."), `hq_url` (destino en Drive), `url` (destino de visualización en Supabase).
- **Storage:** Almacena los assets binarios post-procesados (ej. webp u optimizados).

### 2.3. MIDDLEWARE / PIPELINE (n8n Workflow)
- **Propósito:** Recibir la orden estructurada del Frontend, enrutarla al modelo de IA correcto (FAL), descargar los archivos inmensos generados, optimizarlos y subirlos a bases definitivas (Drive/Supabase). Todo esto de manera asíncrona sin bloquear la web.
- **Flujo Estricto del Workflow (n8n_latest_workflow.json):**
  1. `Webhook`: Punto de entrada HTTP que viene desde React.
  2. `Init Telemetry` (Supabase Update): Registra el task en la BD con 0% y mensaje inicial.
  3. `Format Builder` (Code Node): El "cerebro" del formato. Agarra el `modelId`, inscribe configuraciones por defecto, y _sobreescribe_ con los `settings` mandados por el usuario. Asegura devolver un Payload estandarizado `[{ json: { payload: {...}, task_id: ... } }]`.
  4. Desde el Format Builder, el flujo **SE RAMIFICA EN PARALELO** en dos caminos obligatorios para evitar cuellos de botella y "skip" blocks:
     - **Camino A (Telemetría UI):** `Telemetry Generating` (Supabase). Escribe "Summoning [Modelo]..." y avance al 30%.
     - **Camino B (Acción Pura):** `FAL.AI Engine` (HTTP Node). Lanza el POST a FAL.run con el Payload de la IA.
  5. `Extract Result` (Code Node): Recoge la respuesta de FAL y extrae unánimemente el URL resultante mitigando los distintos JSON schemas de la IA.
  6. `Telemetry Downloading` (Supabase): Update a 60% y mensaje "Artwork generated! Downloading HQ...".
  7. `Download HQ Binary` (HTTP): Accede al URL generado y lo baja a la memoria temporal de n8n.
  8. Alojamiento (`Upload HQ to Drive`, `Optimize WebP`, `Supabase Storage`): Carga el archivo en nubes finales.
  9. `Final Telemetry` (Supabase): Update a 100%, status="ready" e inyecta los links finales. En este momento el Frontend detecta que terminó y lo muestra.

---

## 3. COMPORTAMIENTOS CONOCIDOS Y PRECAUCIONES TÉCNICAS (Bugs y Gotchas)

- **El "Silencio" de n8n (Nodo saltado):** Si en n8n encadenas un nodo que opera sobre base de datos (Ej: `Telemetry Generating` - Supabase Update) directamente detrás o delante de un nodo normal, si el Update no devuelve contenido (porque lo configuraste sin "Return All" o "Return Fields"), n8n pasa **`0 items`**. Los nodos consecuentes que reciban `0 items` NO DAN ERROR, se abortan/saltan silenciosamente. Por ello, la telemetría y la generación (Camino A y Camino B) **siempre** deben estar cableadas en modo paralelo (Bifurcándose desde el mismo nodo de Código), nunca secuenciales.
- **Formateadores de Código:** En los nodos Code genéricos de n8n, siempre hay que retornar los datos forzosamente recubiertos con `[{ json: { ... } }]`.
- **404 Model Not Found en FAL:** A lo largo del proyecto hubieron prefijos antiguos en el código (ej. fal-ai/flux-pro/v1.1/ultra vs fal-ai/flux-pro/v1.1-ultra). El nodo de `Format Builder` incluye sanitizadores de legacy code para pre-captar identificadores mal listados por el frontend y convertirlos.

## 4. CÓMO USAR ESTE CONTEXTO (Instrucciones para otros agentes)
Para cualquier cambio estructural o de implementación, debes usar esta guía como mapa definitivo:
- Si vas a modificar el UI de nodos, revisa la función local de polling en el App.jsx de React para no desincronizarla de las alertas (status_message) listadas aquí.
- Si vas a añadir una IA nueva, el Payload dinámico lo genera el Web y lo termina de construir el `Format Builder` en n8n. Asegúrate de añadir el parser a ambos.
- Todo lo que hagas debe respetar fuertemente el "Midnight Glass": fondos semitransparentes, desenfoque (backdrop-filter) y una estética premium nocturna.
