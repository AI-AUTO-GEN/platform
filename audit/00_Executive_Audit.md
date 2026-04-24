# Auditoría Ejecutiva y Visión Estratégica - Renderfarm (AI AutoGen)
**Fecha:** 24 de Abril de 2026

## 1. La Visión y Razón de Ser
**Nuestra misión es democratizar la producción audiovisual de calidad Hollywood.**
Actualmente, los creadores sufren una fragmentación masiva: usan diferentes herramientas para guiones, imágenes, vídeo y voz, pagando múltiples suscripciones ciegas y perdiendo archivos por el camino. 

**Renderfarm** nace para ser el **único estudio integral** impulsado por IA. Es el lugar donde una idea entra, es desarrollada por un asistente de dirección, desglosada en planos, renderizada con los mejores motores del mundo y exportada a postproducción. Esta es nuestra estrella polar: control total, creatividad sin fricciones y rentabilidad escalable.

---

## 2. QUÉ HACE la Plataforma (Funcionalidades Core)
Este es el alcance funcional completo y exhaustivo de lo que la plataforma permite lograr al usuario final:

### 🎬 A. Preproducción y Dirección (Idea-to-Movie)
- **Generación de Guiones:** Transforma una idea cruda de 2 líneas en un guion profesional completo (formato industria).
- **Desglose en Shotlist:** Analiza el guion y lo fragmenta automáticamente en planos individuales (Tipo de plano, acción, cámara, diálogos).
- **Extracción de Entidades:** Identifica y extrae automáticamente Personajes, Props (Atrezzo) y Entornos del shotlist para mantener la coherencia visual.
- **Asistente de Dirección Interactivo:** Permite al usuario dar directrices naturales ("Haz este plano más oscuro") y la IA reescribe el plano manteniendo el contexto de la historia.
- **Optimización de Prompts (Prompt Enhancement):** Toma una descripción sencilla y la convierte en un prompt de nivel ingeniería adaptado específicamente al modelo de IA seleccionado (inyectando presets visuales).

### ⚙️ B. Producción Multimodal (La Granja)
- **Generación de Imagen (Concept Art & Keyframes):** Creación de imágenes de altísima fidelidad.
- **Generación de Vídeo (Cinemáticas):** Animación de imágenes o generación de vídeo desde texto con controles de cámara, duración y resolución.
- **Generación de Audio y Lipsync:** Creación de locuciones (TTS), efectos, música y sincronización labial.
- **Generación 3D:** Creación de modelos 3D exportables (GLB, OBJ) para props o entornos.
- **Renderizado Concurrente:** Posibilidad de encolar múltiples tomas a la vez sin bloquear la interfaz de usuario.

### 💼 C. Gestión de Producción y Control Comercial
- **Cotizador Transparente (Pay-as-you-go):** Muestra el coste exacto (en céntimos) *antes* de generar cada plano. No hay suscripciones ciegas.
- **Tracking de Gasto en Tiempo Real:** Acumula y muestra el coste total de la sesión de renderizado actual.
- **Control de Versiones (Comparador):** Guarda el historial de todas las tomas generadas para poder compararlas en paralelo y aprobar la mejor.
- **Colaboración Segura (Project Shares):** Generación de enlaces de solo lectura (públicos o privados) para que los clientes aprueben tomas sin acceso al motor de render o al saldo.
- **Exportación Directa a NLE:** Exportación de todos los planos aprobados a CSV/JSON para ingestión directa en software de edición (ej. Adobe Premiere).

---

## 3. CÓMO LO HACE (Orientación Interna)
Para conseguir las funcionalidades descritas, el ecosistema técnico se articula de la siguiente manera:

- **Orquestación Asíncrona:** Una red de webhooks (n8n) gestiona el tráfico entre el frontend y los proveedores de IA (FAL AI), permitiendo que la interfaz nunca se congele.
- **El Cerebro IA:** Las funciones de dirección y guion operan conectadas a modelos ultrarrápidos (Gemini 3 Flash de Google AI Studio) usando un proxy seguro.
- **Almacenamiento Dual (Backup Automático):** Todo el material renderizado se descarga y se envía automáticamente a Google Drive (Backup en Alta Calidad / Másters) y simultáneamente se optimiza a WebP/MP4 en Supabase Storage (Visualización rápida en web).
- **Persistencia en Tiempo Real:** Un backend basado en Supabase (PostgreSQL + WebSockets) guarda un "contrato" JSON continuo de cada proyecto, garantizando que si el navegador se cierra, no se pierda ni un milisegundo de trabajo.
- **Motor Multi-idioma:** La estructura está preparada (i18n) para que las instrucciones fluyan en inglés y español.

---

## 4. Público Objetivo y Negocio
- **Público:** Agencias creativas, directores, estudios indie y creadores de contenido.
- **Negocio:** La plataforma añade un margen comercial (markup) sobre el coste puro de la API. El cliente gana una herramienta todo-en-uno predecible y nosotros escalamos la facturación volumen por volumen, click a click.
