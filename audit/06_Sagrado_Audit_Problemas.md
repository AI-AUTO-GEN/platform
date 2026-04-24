# El Sagrado Audit - Problemas, Fallos y Deuda Técnica (V07)
**Fecha:** 24 de Abril de 2026

Este documento detalla la inspección profunda "hasta debajo del protón" de la aplicación actual (`App.jsx` y su ecosistema). Aquí se exponen todas las vías muertas, botones rotos y desconexiones entre lo visual (Frontend) y lo real (Backend / n8n / Supabase).

---

## 1. Desconexión Crítica en el Motor de Render (El Inspector "Fantasma")
* **Problema:** El Inspector de la derecha lee el esquema de la base de datos y crea parámetros dinámicamente (`seed`, `guidance_scale`, `loras`, etc.). El usuario puede modificarlos y se guardan en el estado (y en el JSON de Supabase). 
* **El Fallo Crítico:** Cuando se pulsa el botón **"Generate"**, la función `handleGenerate()` ignora todos esos parámetros. Solo envía a n8n el `aspect_ratio` y `resolution` (hardcodeados en el payload). 
* **Consecuencia:** Da igual cuánto ajuste el usuario el "Guidance Scale"; el backend de n8n jamás lo recibe y FAL AI ejecuta con los valores por defecto.

## 2. Componentes Masivos Huérfanos (Código Muerto en la Sombra)
* **Problema:** Existen módulos gigantescos en el directorio que no están conectados a la interfaz principal (`App.jsx`).
* **Casos:**
  - `NodeCanvas.jsx` (24KB de código avanzado de nodos) **no está importado**.
  - `EntityTaskCard.jsx` (11KB) **no está importado**.
  - `EnhanceButton.jsx` (8KB) **no está importado**.
  - `geminiService.js` (Todo el Director Pipeline para Guion y Shotlist) no tiene ningún panel que lo invoque en la interfaz actual. La app que ve el público es un "cascarón" de la aplicación real que tenemos en archivos.

## 3. Botón de IA ("Enhance Prompt") Ciego al Contexto
* **Problema:** El botón de la varita en la barra inferior (para mejorar prompts con Gemini) llama a la función `handleEnhance`.
* **El Fallo Crítico:** La llamada en el código (línea 614) tiene el modelo incrustado a fuego: `enhancePrompt(promptText, null, 'fal-ai/flux-pro/v1.1')`.
* **Consecuencia:** Si el usuario tiene seleccionado generar un vídeo con Kling o audio con ElevenLabs y pulsa "Mejorar", la IA le devolverá un prompt diseñado para crear imágenes con Flux.

## 4. Modos de Generación Falsos (Audio / 3D)
* **Problema:** Los botones de "Audio" (🎵) y "3D" (🧊) en el creador de prompts cambian la categoría del *Shot*.
* **El Fallo Crítico:** Al crear el *Shot*, la función `handlePromptSend` le inyecta a traición el modelo `fal-ai/flux-pro/v1.1` por defecto, ignorando que el modo seleccionado requiere un modelo de sonido o 3D.
* **Consecuencia:** Intenta mandar prompts de audio al motor de generación de imagen.

## 5. El Panel de Assets es Estático (Solo Lectura)
* **Problema:** El panel derecho ("Assets" con pestañas Characters, Props, Envs) renderiza correctamente las entidades del proyecto... siempre que el JSON base ya venga relleno.
* **El Fallo Crítico:** **No existe ni un solo botón para añadir** un nuevo asset. Es un panel de puro adorno visual ahora mismo, imposible de usar por un usuario desde cero sin inyectarle código en la base de datos directamente.

## 6. Falsos Espejismos en la Interfaz (Botones Muertos)
* **Pestañas del Dock:** El usuario puede pulsar "History" o "Exports" en el pie de página. El estado cambia internamente, pero **la UI no hace nada**. No hay ninguna vista programada para renderizar el historial ni las exportaciones.
* **Sandbox / Edit Mode:** Pulsar "Sandbox" o "Edit" tira una alerta por pantalla ("Sandbox mode..."), pero a nivel de código no modifican en nada la lógica de consumo de créditos del sistema ni cómo se comporta el render.

## 7. Contador de Costes Volátil y Améscio
* **Problema:** La esquina inferior derecha marca "Session: $0.00". Si el usuario gasta $5.00, el número sube correctamente sumando los eventos de base de datos en tiempo real.
* **El Fallo Crítico:** Si el usuario recarga la página (F5), la variable `sessionCost` se reinicializa a $0.00 de manera amnésica. No consulta la tabla `user_wallets` para recuperar el gasto histórico real de la sesión o del proyecto.

## 8. Consulta Parásita a la Base de Datos (Seguridad/Rendimiento)
* **Problema:** Al invitar a un usuario en el panel de Share, la función `handleInvite()` hace un `select` a `user_wallets` para buscar a esa persona.
* **El Fallo Crítico:** Después de hacer la consulta, el código ignora totalmente el resultado (variable `userData`) y procede a invitar usando un insert ciego a la tabla `project_shares`. Gastamos ancho de banda y latencia sin motivo real.

## 9. VULNERABILIDAD CRÍTICA: Bypass de Pagos desde el Navegador (Webhook n8n)
* **Problema:** En `App.jsx`, al pulsar "Generate" (línea 213), el navegador envía un POST directamente al webhook de n8n.
* **El Fallo Crítico:** El payload envía el ID del usuario (`profile_id: session?.user?.id`) **en texto plano dentro del JSON**. El webhook de n8n no verifica un token JWT firmado de Supabase.
* **Consecuencia:** Cualquier usuario con conocimientos básicos de F12 (DevTools) puede hacer un POST manual cambiando el `profile_id` por el de otro usuario. Generará contenido gastando el saldo de la cartera de otra persona, y las imágenes le llegarán a ese pobre usuario.

## 10. VULNERABILIDAD CRÍTICA: Fuga de Clave en el Proxy de Gemini
* **Problema:** En `geminiService.js` (línea 10), se intenta coger el `access_token` de la sesión para autorizar la llamada al proxy de Gemini.
* **El Fallo Crítico:** Si la sesión no tiene token por lo que sea, el código usa la **clave anónima pública** de Supabase como si fuera el Bearer Token.
* **Consecuencia:** Es una puerta trasera gigante. Si el proxy espera un JWT para identificar quién hace la petición, al meterle la clave pública, o bien revienta porque no tiene firma, o bien se lo traga rompiendo la autenticación.

## 11. Bomba DDoSO (N+1) contra Supabase (El Hook `useDriveMedia.js`)
* **Problema:** El hook `useDriveMedia.js` escucha la tabla `renderfarm_outputs` para actualizar las imágenes en directo.
* **El Fallo Crítico:** Cuando llega un cambio, en vez de inyectar esa única imagen en el estado, llama a `refresh()`, que hace un `SELECT *` masivo de toda la base de datos.
* **Consecuencia:** Si generas 10 imágenes a la vez, recibes 10 eventos websocket, lo que lanza **10 SELECTs masivos** simultáneos contra la base de datos por cliente.

## 12. Estimaciones de Precio "Pinocho" (Frontend Mentiroso)
* **Problema:** `PricingEngine.js` hace una estimación del coste de generar de manera local en el frontend basándose en objetos duros en el código (`FALLBACK_PRICING`).
* **Consecuencia:** Si Fal.ai sube el precio a 0.08$ y n8n lo cobra a 0.08$, pero el frontend sigue diciendo "0.04$", el usuario verá que le quitan el doble de dinero sin avisarle. 

## 13. VULNERABILIDAD CRÍTICA: La Fábrica de Dinero Infinito (Wallet Bypass)
* **Problema:** El módulo `Wallet.jsx` incluye un botón de simulación "Pay with Stripe" para añadir fondos. 
* **El Fallo Crítico:** Llama a la función de RPC `dev_add_funds` mandando la cantidad desde el cliente web. Si esa función RPC no tiene validaciones de seguridad en PostgreSQL, cualquier persona desde Postman o la consola puede ejecutarla, mandarse 1.000.000$ y fondear su cuenta gratis sin pagar a Stripe.

## 14. Bomba DDoSO #2 (El Martillo del Wallet)
* **Problema:** El componente de la cartera (`Wallet.jsx`, línea 25) no utiliza suscripciones Realtime (WebSockets) de Supabase para escuchar cambios en el saldo.
* **El Fallo Crítico:** Utiliza un brutal `setInterval(fetchBalance, 10000)`. Cada usuario con la web abierta hace un `SELECT balance` puro y duro cada 10 segundos, de por vida, lo necesite o no.

## 15. El Agujero Negro de Google Drive (Archivos Inmortales)
* **Problema:** Al borrar una imagen en la interfaz, `assetUtils.js` manda una petición POST a n8n diciendo `{ action: 'delete_file', file_id: "ID_DE_DRIVE" }`.
* **El Fallo Crítico:** ¡El workflow de n8n no tiene configurada ninguna ruta lógica para borrar! Ignora las peticiones con `action: 'delete_file'`.
* **Consecuencia:** La base de datos local borra su referencia, pero el archivo maestro High Quality (que puede pesar 100MB o ser un vídeo 4K) **jamás se borra** de tu Google Drive. Tu cuenta de Drive se llenará y colapsará y el usuario ni lo sabrá.

## 16. Parseo de Guiones Amnésico (Más Modelos Hardcodeados)
* **Problema:** Cuando el usuario importa un JSON B_CONTRACT completo (`assetUtils.js`, línea 161), la plataforma recrea las escenas (Shots).
* **El Fallo Crítico:** Inyecta automáticamente `modelId: 'fal-ai/flux-pro/v1.1-ultra'` a todas y cada una de las tomas que se importan, sin importar de qué categoría son (si el guion pedía un clip de vídeo, la plataforma forzará generación de imagen).

## 17. Bomba DDoSO #3: Pánico en el ReactFlow (`NodeCanvas.jsx`)
* **Problema:** En `NodeCanvas.jsx`, el `useEffect` principal que re-dibuja los nodos depende del array `media` completo. 
* **El Fallo Crítico:** Cada vez que el webhook de n8n o la BD notifica un simple cambio de progreso ("10%...", "12%..."), `useDriveMedia` altera el array `media`. Esto dispara una destrucción y recreación completa de todo el canvas (`setNodes`, `setEdges`). Si hay 50 nodos y estás haciendo zoom para editar, el canvas te sacará a trompicones cada medio segundo, imposibilitando la edición mientras renderiza.

## 18. Fuga de Memoria Severa por Eventos Globales (`EntityTaskCard.jsx`)
* **Problema:** Cada `EntityTaskCard` que renderiza una imagen en pantalla completa monta un `window.addEventListener('keydown')` para escuchar la tecla Escape.
* **El Fallo Crítico:** La dependencia del Hook de React está vacía `[]`. Si tienes 50 tomas renderizadas en la interfaz, tu navegador tiene 50 event listeners globales peleando en segundo plano por interceptar la tecla Escape.

## 19. "Silicone Base" Destrozando el Framerate (DOM Paint Leak)
* **Problema:** Los nodos en `NodeCanvas` usan el wrapper visual `<Tactile>`.
* **El Fallo Crítico:** Para conseguir el efecto de silicona "físico", `Tactile.jsx` rastrea el evento global `onMouseMove` e inyecta dinámicamente propiedades CSS por Javascript (`elRef.current.style.setProperty('--mask', ...)`). Hacer inyecciones directas al DOM en cada pixel que se mueve el ratón, multiplicadas por cada nodo en pantalla simultáneamente, destrozará la CPU en proyectos grandes a 2fps.

## 20. VULNERABILIDAD CRÍTICA #4: Ataque de Exportación Ciega a N8N (`exportUtils.js`)
* **Problema:** La función `triggerN8NExport` llama al webhook `export-project` de N8N.
* **El Fallo Crítico:** No existe token de sesión ni validación. Cualquiera puede mandar miles de POSTs con nombres de proyectos falsos (o el tuyo). Además, N8N no valida que el proyecto te pertenezca. Un atacante puede desencadenar que N8N descargue GBs de Google Drive haciendo colapsar los recursos o vaciando el crédito de la nube.
* **Colapso del Polling:** Tras mandar el export, el frontend hace un `setInterval` cada 5 segundos haciendo un `SELECT export_url FROM projects WHERE name = 'Nombre' .single()`. Como los nombres de proyecto no son únicos garantizados a nivel global, si hay dos proyectos llamados "Test", Supabase explotará y la exportación jamás terminará.

## 21. El Botón Nuclear Falso (El Gran Engaño de `QuotaWidget.jsx`)
* **Problema:** Cuando tu almacenamiento llega al límite (500MB), el widget de cuota saca un botón de pánico que llama a `supabase.rpc('delete_user_data')`.
* **El Fallo Crítico:** El RPC de Supabase solo puede borrar lo que está en Supabase (registros de la BD y Storage WebP). Los renders reales pesados residen en Google Drive. El usuario pulsa, su cuota baja a cero mágicamente en la UI, pero **Drive sigue colapsado** y los archivos han perdido el rastro de la base de datos (se vuelven archivos zombis ilocalizables en tu Google Drive).
* **Extra:** ¡Otra bomba DDoSO! Este widget también hace un `setInterval` cada 30 segundos llamando al RPC contra el servidor en vez de mantener un contador local.

## 22. Esquizofrenia de Opciones (UI Ciega en `modelRegistry.js`)
* **Problema:** El Inspector depende de `getModelOptions(modelId)` para mostrar campos de UI (como `Duration` para vídeos o `Resolution`). Esta función se basa ciegamente en hacer `includes()` al nombre del modelo.
* **El Fallo Crítico:** Debido al Fallo 16 (donde se inyecta por fuerza bruta el modelo de imagen de Flux al importar guiones), cuando vayas a editar un Vídeo, la UI creerá que es una imagen. **Los controles de vídeo jamás se renderizarán** y será imposible cambiar la duración o los fps.

---
**CONCLUSIÓN DEL EXAMEN FORENSE:**
La plataforma es espectacular a nivel estético, pero es una fachada de Hollywood. Por detrás es un colador de seguridad a nivel bancario (N8N webhook desprotegido, RPC de cartera abierta), destructora de servidores (4 loops diferentes de DDoSO contra Supabase a 10s, 30s y 5s) y genera un agujero negro de basura incontrolable en tu cuenta de Google Drive.

El "Director Pipeline" ni siquiera está montado en la interfaz que ve el usuario final. 

**Plan de Reparación Obligatorio:**
1. Blindar los Webhooks de N8N con Auth Headers y Supabase Tokens.
2. Cerrar el `dev_add_funds` o añadir RLS / comprobaciones de `auth.uid()`.
3. Migrar todos los `setInterval` a `supabase.channel` (Realtime de verdad).
4. Unificar `App.jsx` para que importe por fin `NodeCanvas`, el `geminiService` y respete el `Inspector`.
5. Crear el Flow de "Borrado en Drive" real desde Supabase Edge Functions o un Webhook seguro en n8n.
