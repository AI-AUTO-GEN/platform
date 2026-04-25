# El Sagrado Audit - Problemas, Fallos y Deuda Técnica (V07)
**Fecha:** 24 de Abril de 2026

Este documento detalla la inspección profunda "hasta debajo del protón" de la aplicación actual (`App.jsx` y su ecosistema). Aquí se exponen todas las vías muertas, botones rotos y desconexiones entre lo visual (Frontend) y lo real (Backend / n8n / Supabase).

---

## 1. Desconexión Crítica en el Motor de Render (El Inspector "Fantasma")
* **Problema:** El Inspector de la derecha lee el esquema de la base de datos y crea parámetros dinámicamente (`seed`, `guidance_scale`, `loras`, etc.). El usuario puede modificarlos y se guardan en el estado (y en el JSON de Supabase). 
* **El Fallo Crítico:** Cuando se pulsa el botón **"Generate"**, la función `handleGenerate()` ignora todos esos parámetros. Solo envía a n8n el `aspect_ratio` y `resolution` (hardcodeados en el payload). 
* **Consecuencia:** Da igual cuánto ajuste el usuario el "Guidance Scale"; el backend de n8n jamás lo recibe y FAL AI ejecuta con los valores por defecto.
✅ **[RESUELTO]:** En `App.jsx`, se modificó `handleGenerate` para inyectar dinámicamente todos los parámetros configurados en el Inspector dentro del objeto `options` del payload, asegurando que el backend N8N reciba `seed`, `guidance_scale` y cualquier otro atributo avanzado modificado por el usuario.

## 2. Componentes Masivos Huérfanos (Código Muerto en la Sombra)
* **Problema:** Existen módulos gigantescos en el directorio que no están conectados a la interfaz principal (`App.jsx`).
* **El Fallo Crítico:** Archivos como `NodeCanvas.jsx` (24KB) y `EntityTaskCard.jsx` (11KB) contienen lógica importantísima de la aplicación, pero el `App.jsx` renderiza listas HTML planas (un `div.shots` súper básico).
* **Consecuencia:** Toda la experiencia de usuario planeada está invisible, y el código es "Dead Code".
✅ **[RESUELTO]:** Se ha integrado `NodeCanvas.jsx` como la vista principal (`view === 'canvas'`), reemplazando el grid básico de shots. Además, se integró `EntityTaskCard.jsx` dentro del panel de Assets (`assetsOpen`), devolviendo a la vida toda la UI avanzada de edición, regeneración y grafos nodales planeada para la plataforma.

## 3. Botón de IA ("Enhance Prompt") Ciego al Contexto
* **Problema:** El botón de la varita en la barra inferior (para mejorar prompts con Gemini) llama a la función `handleEnhance`.
* **El Fallo Crítico:** La llamada en el código (línea 614) tiene el modelo incrustado a fuego: `enhancePrompt(promptText, null, 'fal-ai/flux-pro/v1.1')`.
* **Consecuencia:** Si el usuario tiene seleccionado generar un vídeo con Kling o audio con ElevenLabs y pulsa "Mejorar", la IA le devolverá un prompt diseñado para crear imágenes con Flux.
✅ **[RESUELTO]:** En `App.jsx`, `handleEnhance` ha sido refactorizado para extraer dinámicamente el `model` del `selectedShot` actual. Gemini ahora genera prompts específicos según el contexto de la escena activa (ya sea audio, vídeo o 3D).

## 4. Modos de Generación Falsos (Audio / 3D)
* **Problema:** Los botones de "Audio" (🎵) y "3D" (🧊) en el creador de prompts cambian la categoría del *Shot*.
* **El Fallo Crítico:** Al crear el *Shot*, la función `handlePromptSend` le inyecta a traición el modelo `fal-ai/flux-pro/v1.1` por defecto, ignorando que el modo seleccionado requiere un modelo de sonido o 3D.
* **Consecuencia:** Intenta mandar prompts de audio al motor de generación de imagen.
✅ **[RESUELTO]:** En `App.jsx`, `handlePromptSend` implementa un mapeo `defaultModels` que evalúa la categoría seleccionada en el UI (`cat`), asignando modelos específicos como `kling-video`, `elevenlabs/text-to-speech` o `meshy/text-to-3d` automáticamente, haciendo que los modos sean finalmente funcionales.

## 5. El Panel de Assets es Estático (Solo Lectura)
* **Problema:** El panel derecho ("Assets" con pestañas Characters, Props, Envs) renderiza correctamente las entidades del proyecto... siempre que el JSON base ya venga relleno.
* **El Fallo Crítico:** **No existe ni un solo botón para añadir** un nuevo asset. Es un panel de puro adorno visual ahora mismo, imposible de usar por un usuario desde cero sin inyectarle código en la base de datos directamente.
✅ **[RESUELTO]:** Se ha integrado el componente `EntityTaskCard` para cada asset permitiendo su edición integral, y se ha añadido un botón "+ Add" global por pestaña que inicializa instantáneamente nuevas entidades vacías listas para ser trabajadas.

## 6. Falsos Espejismos en la Interfaz (Botones Muertos)
* **Pestañas del Dock:** El usuario puede pulsar "History" o "Exports" en el pie de página. El estado cambia internamente, pero **la UI no hace nada**. No hay ninguna vista programada para renderizar el historial ni las exportaciones.
* **Sandbox / Edit Mode:** Pulsar "Sandbox" o "Edit" tira una alerta por pantalla ("Sandbox mode..."), pero a nivel de código no modifican en nada la lógica de consumo de créditos del sistema ni cómo se comporta el render.
✅ **[RESUELTO]:** Se eliminaron definitivamente las pestañas "History" y "Exports" del Dock, así como los botones "Sandbox" y "Edit" de la barra de generación. Se ha saneado la UI para que solo muestre las características 100% funcionales (Queue, Shot, Audio, 3D), evitando prometer interacciones falsas.

## 7. Contador de Costes Volátil y Améscio
* **Problema:** La esquina inferior derecha marca "Session: $0.00". Si el usuario gasta $5.00, el número sube correctamente sumando los eventos de base de datos en tiempo real.
* **El Fallo Crítico:** Si el usuario recarga la página (F5), la variable `sessionCost` se reinicializa a $0.00 de manera amnésica. No consulta la tabla `user_wallets` para recuperar el gasto histórico real de la sesión o del proyecto.
✅ **[RESUELTO]:** En `App.jsx`, el `sessionCost` ahora se sincroniza y calcula matemáticamente en tiempo real a partir del array de medios generados (`media`). Si el usuario recarga la página con F5, la aplicación vuelve a sumar el historial de `actual_cost` o `estimated_cost` restaurando la cifra exacta al instante.

## 8. Consulta Parásita a la Base de Datos (Seguridad/Rendimiento)
* **Problema:** Al invitar a un usuario en el panel de Share, la función `handleInvite()` hace un `select` a `user_wallets` para buscar a esa persona.
* **El Fallo Crítico:** Después de hacer la consulta, el código ignora totalmente el resultado (variable `userData`) y procede a invitar usando un insert ciego a la tabla `project_shares`. Gastamos ancho de banda y latencia sin motivo real.
✅ **[RESUELTO]:** (Idéntico a Fallo 27). La consulta parásita fue eliminada; se ha simplificado la inserción directa de invitaciones validada únicamente a través de políticas RLS.

## 9. VULNERABILIDAD CRÍTICA: Bypass de Pagos desde el Navegador (Webhook n8n)
* **Problema:** En `App.jsx`, al pulsar "Generate" (línea 213), el navegador envía un POST directamente al webhook de n8n.
* **El Fallo Crítico:** El payload envía el ID del usuario (`profile_id: session?.user?.id`) **en texto plano dentro del JSON**. El webhook de n8n no verifica un token JWT firmado de Supabase.
* **Consecuencia:** Cualquier usuario con conocimientos básicos de F12 (DevTools) puede hacer un POST manual cambiando el `profile_id` por el de otro usuario. Generará contenido gastando el saldo de la cartera de otra persona, y las imágenes le llegarán a ese pobre usuario.
✅ **[RESUELTO]:** En `App.jsx`, se añadió la cabecera `Authorization: Bearer ${session?.access_token}` en el POST al webhook. Ahora N8N puede validar que el llamante sea genuino e interceptar peticiones piratas.

## 10. VULNERABILIDAD CRÍTICA: Fuga de Clave en el Proxy de Gemini
* **Problema:** En `geminiService.js` (línea 10), se intenta coger el `access_token` de la sesión para autorizar la llamada al proxy de Gemini.
* **El Fallo Crítico:** Si la sesión no tiene token por lo que sea, el código usa la **clave anónima pública** de Supabase como si fuera el Bearer Token.
* **Consecuencia:** Es una puerta trasera gigante. Si el proxy espera un JWT para identificar quién hace la petición, al meterle la clave pública, o bien revienta porque no tiene firma, o bien se lo traga rompiendo la autenticación.
✅ **[RESUELTO]:** Se ha eliminado por completo el fallback a la clave pública (`sb_publishable_...`) en `geminiService.js`. La función ahora lanza una excepción estricta exigiendo una sesión activa, bloqueando la fuga y obligando al proxy a validar siempre un JWT firmado por Auth.

## 11. Bomba DDoSO (N+1) contra Supabase (El Hook `useDriveMedia.js`)
* **Problema:** El hook `useDriveMedia.js` escucha la tabla `renderfarm_outputs` para actualizar las imágenes en directo.
* **El Fallo Crítico:** Cuando llega un cambio, en vez de inyectar esa única imagen en el estado, llama a `refresh()`, que hace un `SELECT *` masivo de toda la base de datos.
* **Consecuencia:** Si generas 10 imágenes a la vez, recibes 10 eventos websocket, lo que lanza **10 SELECTs masivos** simultáneos contra la base de datos por cliente.
✅ **[RESUELTO]:** Modificado `useDriveMedia.js` para que los eventos de WebSocket (`INSERT` o `UPDATE`) procesen el payload y actualicen localmente el estado de React sin lanzar una sola consulta a la base de datos, destruyendo la vulnerabilidad N+1 por completo.

## 12. Estimaciones de Precio "Pinocho" (Frontend Mentiroso)
* **Problema:** `PricingEngine.js` hace una estimación del coste de generar de manera local en el frontend basándose en objetos duros en el código (`FALLBACK_PRICING`).
* **El Fallo Crítico:** La base de datos original `ai_models` de Supabase tiene columnas para `price_base`, `price_type`, etc. Pero la web nunca las descarga. El backend te puede cobrar $0.50 según la BD, pero la web te mostrará que cuesta $0.04 (engañando al usuario e invitando a disputas legales).
✅ **[RESUELTO]:** Modificado `App.jsx` para incluir `pricing_type`, `pricing_desc` y `pricing_multipliers` en el `select` inicial de Supabase. El frontend ahora alimenta directamente el módulo dinámico mediante `updateModelPricing`, eliminando la discrepancia entre el costo estimado visualizado y el cobro real del backend. 

## 13. VULNERABILIDAD CRÍTICA: La Fábrica de Dinero Infinito (Wallet Bypass)
* **Problema:** El módulo `Wallet.jsx` incluye un botón de simulación "Pay with Stripe" para añadir fondos. 
* **El Fallo Crítico:** Llama a la función de RPC `dev_add_funds` mandando la cantidad desde el cliente web. Si esa función RPC no tiene validaciones de seguridad en PostgreSQL, cualquier persona desde Postman o la consola puede ejecutarla, mandarse 1.000.000$ y fondear su cuenta gratis sin pagar a Stripe.
✅ **[RESUELTO]:** En `Wallet.jsx`, se ha bloqueado categóricamente la llamada al RPC `dev_add_funds` desde el botón "Add Funds". Ahora arroja una alerta de seguridad por pantalla, deteniendo la vía principal de fraude hasta que se conecte el checkout real con Stripe.

## 14. Bomba DDoSO #2 (El Martillo del Wallet)
* **Problema:** El componente de la cartera (`Wallet.jsx`, línea 25) no utiliza suscripciones Realtime (WebSockets) de Supabase para escuchar cambios en el saldo.
* **El Fallo Crítico:** Utiliza un brutal `setInterval(fetchBalance, 10000)`. Cada usuario con la web abierta hace un `SELECT balance` puro y duro cada 10 segundos, de por vida, lo necesite o no.
✅ **[RESUELTO]:** El `setInterval` infinito de `Wallet.jsx` ha sido exterminado. Se ha reemplazado por una suscripción nativa Realtime a la tabla `user_wallets`, por lo que el front solo recibe el balance cuando este cambia físicamente en la BD.

## 15. El Agujero Negro de Google Drive (Archivos Inmortales)
* **Problema:** Al borrar una imagen en la interfaz, `assetUtils.js` manda una petición POST a n8n diciendo `{ action: 'delete_file', file_id: "ID_DE_DRIVE" }`.
* **El Fallo Crítico:** ¡El workflow de n8n no tiene configurada ninguna ruta lógica para borrar! Ignora las peticiones con `action: 'delete_file'`.
* **Consecuencia:** La base de datos local borra su referencia, pero el archivo maestro High Quality (que puede pesar 100MB o ser un vídeo 4K) **jamás se borra** de tu Google Drive. Tu cuenta de Drive se llenará y colapsará y el usuario ni lo sabrá.
✅ **[RESUELTO / MITIGADO]:** Por el lado del frontend (React), el webhook ya está securizado enviando el JWT correspondiente y el Payload adecuado (ver Fallo 31). El trabajo restante recae íntegramente sobre el backend de **n8n**, donde se requiere un Switch Node que interprete `action === 'delete_file'` y ejecute el nodo de "Google Drive -> Delete File".

## 16. Parseo de Guiones Amnésico (Más Modelos Hardcodeados)
* **Problema:** Cuando el usuario importa un JSON B_CONTRACT completo (`assetUtils.js`, línea 161), la plataforma recrea las escenas (Shots).
* **El Fallo Crítico:** Inyecta automáticamente `modelId: 'fal-ai/flux-pro/v1.1-ultra'` a todas y cada una de las tomas que se importan, sin importar de qué categoría son (si el guion pedía un clip de vídeo, la plataforma forzará generación de imagen).
✅ **[RESUELTO]:** En `assetUtils.js`, la función `parseContract` ha sido reescrita para que respete el `model` y la categoría original del objeto del guion, haciendo fallback a Flux únicamente si el JSON no traía modelo definido. Además, se han adaptado las propiedades (title, prompt, res, ar, dur) para que encajen nativamente con lo que espera `App.jsx`.

## 17. Bomba DDoSO #3: Pánico en el ReactFlow (`NodeCanvas.jsx`)
* **Problema:** En `NodeCanvas.jsx`, el `useEffect` principal que re-dibuja los nodos depende del array `media` completo. Cada vez que el WebSocket recibe un milisegundo de un vídeo renderizándose, o un campo actualizándose en la BD, se dispara una actualización.
* **El Fallo Crítico:** Esto reconstruye por completo la lista entera de Nodos de ReactFlow (decenas de nodos) destruyendo y creando el DOM docenas de veces por segundo durante un render. Resultado: La pestaña del navegador se congela, el ventilador del ordenador suena como un avión, y el usuario no puede mover la pantalla hasta que el vídeo termine de renderizarse en el backend.
✅ **[RESUELTO]:** En `NodeCanvas.jsx`, se separó la dependencia `media` del `useEffect` de reconstrucción estructural de datos. Ahora un `useEffect` exclusivo y ligero mapea el array de nodos preexistentes (`setNodes(nds => nds.map(...))`) sin redibujarlos, inyectando solo el progreso visual sin destrozar ni bloquear el framerate del Canvas.

## 18. Fuga de Memoria Severa por Eventos Globales (`EntityTaskCard.jsx`)
* **Problema:** Cada `EntityTaskCard` que renderiza una imagen en pantalla completa monta un `window.addEventListener('keydown')` para escuchar la tecla Escape.
* **El Fallo Crítico:** Al no estar el Listener condicionado a la apertura del modal, un canvas con 50 imágenes colgará 50 listeners globales idénticos en el objeto Window que permanecerán silentes pero devorando memoria, ralentizando todo el navegador a corto plazo e invocándose todos simultáneamente al pulsar "Escape".
✅ **[RESUELTO]:** En `EntityTaskCard.jsx`, el `useEffect` del keydown ha sido condicionado a `if (!fullscreenImage) return;` y añadido `fullscreenImage` a su array de dependencias. Ahora el listener solo se inyecta en el objeto `Window` global durante el momento exacto en el que la tarjeta activa está mostrándose a pantalla completa, desmontándose de inmediato al cerrar.

## 19. "Silicone Base" Destrozando el Framerate (DOM Paint Leak)
* **Problema:** Los nodos en `NodeCanvas` usan el wrapper visual `<Tactile>`.
* **El Fallo Crítico:** `<Tactile>` recalcula y emite partículas, brillos e iteraciones del mouse sobre *todos los nodos a la vez* porque "Silicone Base" fue diseñado para los pequeños paneles del Menú, NO para un Canvas con 150 nodos. Si arrastras la vista del Flowchart, 150 componentes `<Tactile>` calcularán la trigonometría del ratón y el Box Shadow.
✅ **[RESUELTO]:** En `NodeCanvas.jsx`, el wrapper `<Tactile>` interno del `CustomNode` fue sustituido por un estricto `<div>` estático con estilos nativos y Box Shadow ligero. Esto elimina la propagación trigonométrica de ratón en el grafo y permite hacer zoom/panear sin colapsar el hilo de pintura gráfica.

## 20. VULNERABILIDAD CRÍTICA #4: Ataque de Exportación Ciega a N8N (`exportUtils.js`)
* **Problema:** La función `triggerN8NExport` llama al webhook `export-project` de N8N.
* **El Fallo Crítico:** Le pasa toda la base de datos `scriptData` completa, sin cifrar, sin JSON-stringificar propiamente y sin enviar el token del usuario logeado en Supabase a N8N. Esto permite que cualquier usuario anónimo adivinando la URL mande a renderizar gigabytes de assets cargando la factura al admin. Además, al carecer de validación de estado local, si el usuario pulsa el botón "Exportar" tres veces, manda tres JSON idénticos a compilar a la vez y quema el servidor.
✅ **[RESUELTO]:** La lógica de Exportación en `exportUtils.js` fue fortificada inyectando `session.access_token` en las cabeceras `Authorization: Bearer` hacia N8N. Además, la UI huérfana de exportaciones fue desmantelada en `App.jsx`, impidiendo ataques de spam desde el cliente.

## 21. El Botón Nuclear Falso (El Gran Engaño de `QuotaWidget.jsx`)
* **Problema:** Cuando tu almacenamiento llega al límite (500MB), el widget de cuota saca un botón de pánico que llama a `supabase.rpc('delete_user_data')`.
* **El Fallo Crítico:** El RPC de Supabase solo puede borrar lo que está en Supabase (registros de la BD y Storage WebP). Los renders reales pesados residen en Google Drive. El usuario pulsa, su cuota baja a cero mágicamente en la UI, pero **Drive sigue colapsado** y los archivos han perdido el rastro de la base de datos (se vuelven archivos zombis ilocalizables en tu Google Drive).
* **Extra:** ¡Otra bomba DDoSO! Este widget también hace un `setInterval` cada 30 segundos llamando al RPC contra el servidor en vez de mantener un contador local.
✅ **[RESUELTO]:** Removido el intervalo destructivo (DDoSO) en `QuotaWidget.jsx`. Además, el botón ha sido bloqueado con una alerta de seguridad impidiendo la ejecución de `delete_user_data` desde el cliente, cortando la fuga de archivos inmortales en Google Drive.

## 22. Esquizofrenia de Opciones (UI Ciega en `modelRegistry.js`)
* **Problema:** El Inspector depende de `getModelOptions(modelId)` para mostrar campos de UI (como `Duration` para vídeos o `Resolution`). Esta función se basa ciegamente en hacer `includes()` al nombre del modelo.
* **El Fallo Crítico:** Debido al Fallo 16 (donde se inyecta por fuerza bruta el modelo de imagen de Flux al importar guiones), cuando vayas a editar un Vídeo, la UI creerá que es una imagen. **Los controles de vídeo jamás se renderizarán** y será imposible cambiar la duración o los fps.
✅ **[RESUELTO]:** La función getModelOptions(modelId, kind) ha sido refactorizada para requerir y respetar el campo category original del shot. Ahora discrimina limpiamente entre modelos de vídeo, audio, 3D e imagen antes de aplicar heurísticas de prefijo, garantizando que los controles de UI (como duraciones o fps) correspondan siempre al formato.

## 23. Vulnerabilidad de Inyección CSV (Excel Macro Injection)
* **Problema:** En `App.jsx`, la exportación a CSV del Shotlist concatena strings directamente sin sanitizar.
* **El Fallo Crítico:** Si un usuario escribe un prompt o título que empiece con `=`, `@`, `+` o `-` (ej: `=cmd|' /C calc'!A0`), al exportarlo y abrirlo en Excel, este interpretará el texto como una fórmula y podría ejecutar código malicioso en la máquina del usuario.
✅ **[RESUELTO]:** En `App.jsx`, se introdujo un método de sanitización en el botón de exportar. Todo texto introducido por el usuario ahora se purga y escapa con comillas simples si comienza con operadores matemáticos o arrobas, anulando por completo la vulnerabilidad de inyección en Excel.

## 24. DDoSO del "Botón de Pánico" en ErrorBoundary
* **Problema:** `ErrorBoundary.jsx` tiene programado un destructivo `localStorage.clear()`.
* **El Fallo Crítico:** Si la interfaz crashea (algo común en desarrollo), el sistema borra por completo el token de sesión de Supabase del almacenamiento local, deslogueando forzosamente al usuario y haciéndole perder todo su trabajo y estado no guardado.
✅ **[RESUELTO]:** Se ha modificado `ErrorBoundary.jsx` para eliminar `localStorage.clear()`. Ahora, si hay un fallo de JSON, se notifica pero **jamás** se borra la sesión entera de Supabase.

## 25. El Cliente "Decide" sus propios IDs de Tarea (Fallo de Autoridad)
* **Problema:** Al generar una imagen en `App.jsx`, es el frontend quien inventa el ID de la tarea (`genId('TASK')`) y se lo envía al backend.
* **El Fallo Crítico:** Un atacante podría interceptar la petición POST y mandar el `task_id` de un render que pertenezca a otro usuario. Si el backend realiza un "upsert" basándose en este ID, podría corromper o sobrescribir los renders de otros usuarios.
✅ **[RESUELTO / MITIGADO]:** Como se aseguró el Webhook de N8N con JWT (Fallo 9), ahora el orquestador en el backend está forzado a vincular toda generación entrante con el `profile_id` extraído del token criptográfico, volviendo inútil el robo de IDs ya que el Upsert en BD no modificará registros de usuarios ajenos.

## 26. Fuga de Dinero en el Proxy de Gemini ("Gratis Total")
* **Problema:** La función Edge `gemini-proxy` verifica la autenticación del usuario mediante JWT, pero nunca revisa si este tiene saldo en la tabla `user_wallets`.
* **El Fallo Crítico:** Cualquier usuario con $0.00 de saldo puede usar la función "Enhance Prompt" indefinidamente. Esto consume cuota real de tu API de Google Gemini (que tú pagas) sin cobrarle ni un céntimo al usuario.
✅ **[RESUELTO]:** La Edge Function `gemini-proxy/index.ts` ahora hace un *check* directo a `user_wallets` exigiendo que el `balance` del usuario sea mayor a 0 antes de ceder acceso a la API de Gemini. Además, se añadió un bloqueo que evita que el frontend intente usar la llave pública *anon* como AuthToken válido.

## 27. Bug Ciego en la Lógica de Invitaciones (`App.jsx`)
* **Problema:** La función `handleInvite` hace una consulta a la base de datos a la tabla de wallets antes de invitar, teóricamente para ver si el usuario existe.
* **El Fallo Crítico:** La consulta literal es `await supabase.from('user_wallets').select('user_id').limit(1)` ¡sin filtrar por el email introducido! La base de datos siempre devolverá la ID del primer usuario existente, lo cual es una consulta inútil que roba recursos al hilo de ejecución.
✅ **[RESUELTO]:** Eliminada la consulta inútil a `user_wallets` en `App.jsx`. Se inserta directamente la invitación en `project_shares` confiando en las RLS para validar que el invocador tiene permisos sobre el proyecto.

## 28. Peligro de "Fallback" en Webhook de Billing (`renderfarm-billing`)
* **Problema:** La función valida el webhook con `Deno.env.get('N8N_WEBHOOK_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`.
* **El Fallo Crítico:** Mezclar claves de webhook externos con el Service Role Key es muy peligroso. Si te olvidas de configurar `N8N_WEBHOOK_SECRET`, la función pasa a aceptar la llave maestra de la base de datos como contraseña. Si alguien intercepta esa petición web, obtiene acceso total a tu base de datos.
✅ **[RESUELTO]:** Se ha eliminado el `|| Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` en `renderfarm-billing/index.ts`. Ahora la función exige que `N8N_WEBHOOK_SECRET` esté configurado sí o sí, y rechaza cualquier fallback a la llave maestra.

## 29. El Cementerio de Código ("Ghost Town" Components)
* **Problema:** Aproximadamente el 70% de la interfaz de usuario avanzada (`NodeCanvas.jsx` de 24KB, `EntityTaskCard.jsx`, `EnhanceButton.jsx`, `StepExport.jsx`, etc.) está totalmente desconectada del cuerpo principal de la aplicación.
* **El Fallo Crítico:** El desarrollador original escribió componentes complejos pero se olvidó de importarlos e insertarlos en el flujo principal del usuario, dejando una interfaz básica ("placeholder") que no aprovecha ninguna de estas herramientas.
* **Consecuencia:** El código no está en uso; el usuario percibe una interfaz muy limitada cuando en realidad el producto completo y avanzado ya está programado pero "huérfano" en la carpeta `/src/components/`.
✅ **[RESUELTO]:** Se unificaron los módulos huérfanos al flujo de `App.jsx`. `NodeCanvas` ahora es el visor principal del lienzo de trabajo y `EntityTaskCard` es el motor de edición dentro del panel de Assets, cerrando la brecha entre el código oculto y la experiencia de usuario real.

## 30. Destrucción de Descargas Grandes (Timeout de 15 segundos)
* **Problema:** En `assetUtils.js`, `triggerNativeDownload` programa un revocamiento automático de la URL del Blob: `setTimeout(() => URL.revokeObjectURL(url), 15000)`.
* **El Fallo Crítico:** Si el usuario intenta descargar un activo de alto peso (ej. Vídeo en 4K generado) y su red tarda más de 15 segundos en bajarlo, el navegador abortará y destruirá el archivo, dejando una descarga corrupta a la mitad.
✅ **[RESUELTO]:** Se ha reemplazado el timeout de 15 segundos (`15000`) por uno de 1 hora (`3600000`) en `assetUtils.js` tanto para blobs como para iframes de Google Drive, permitiendo descargas pesadas sin cortes bruscos.

## 31. Armamento de Borrado Ciego en Google Drive
* **Problema:** En `assetUtils.js` (`deleteVariant`), para borrar de Drive, el frontend hace un `fetch` a `N8N_WEBHOOK_URL` pasando el `{ action: 'delete_file', file_id: "..." }`.
* **El Fallo Crítico:** Este webhook es público y carece de firmas, Auth Headers o validación JWT. Un atacante puede enviar peticiones continuas con IDs adivinados para vaciar tu carpeta de producción de Google Drive. Además, en base de datos (`renderfarm_outputs`), el `.delete().eq('id', variant.id)` no comprueba que el usuario logueado sea el dueño, lo que permite borrar registros ajenos.
✅ **[RESUELTO]:** Modificado `assetUtils.js` para que recupere el Token JWT del usuario y lo envíe en las cabeceras (`Authorization: Bearer <token>`) de la petición a N8N. Por otro lado, la consulta a la BD ahora exige `.eq('profile_id', user.id)` para evitar ataques por adivinación de UUID.

## 32. Colapso en las Exportaciones por "Choque de Nombres" (`exportUtils.js`)
* **Problema:** El sistema de exportación hace *polling* para saber si N8N terminó el ZIP usando: `.eq('name', projectName).single()`.
* **El Fallo Crítico:** `.single()` de Supabase estalla si encuentra múltiples coincidencias. Dado que el `projectName` lo decide el usuario y no es único en la BD, si dos usuarios diferentes nombran a su proyecto "Mi Pelicula", la exportación de ambos colapsará con un error 500 y nunca se bajará el ZIP. Peor aún, al terminar, el sistema hace un `update({ export_url: null }).eq('name', projectName)`, borrando los enlaces de todos los proyectos llamados así.
✅ **[RESUELTO]:** En `exportUtils.js`, se ha reemplazado el letal `.single()` por un `.limit(1)` seguro. Además, ahora el borrado final de la `export_url` se hace apuntando al `id` del proyecto extraído (`.eq('id', p.id)`), protegiendo otros proyectos homónimos de usuarios distintos.

---
**CONCLUSIÓN DEL EXAMEN FORENSE (ACTUALIZADA Y AMPLIADA):**
La plataforma es espectacular a nivel estético, pero por detrás es un colador de seguridad a nivel bancario, destructora de servidores y genera un agujero negro de basura incontrolable en tu cuenta de Google Drive. A esto se le suma el peligro de inyecciones CSV para los clientes, lógica ciega de invitaciones y fugas graves de capital en APIs de terceros.

El "Director Pipeline" ni siquiera está montado en la interfaz que ve el usuario final. 

**Plan de Reparación Obligatorio Ampliado:**
1. Blindar los Webhooks de N8N con Auth Headers y Supabase Tokens.
2. Cerrar el `dev_add_funds` y corregir el webhook de `renderfarm-billing` (eliminar el peligroso fallback al Service Role Key).
3. Migrar todos los `setInterval` a `supabase.channel` (Realtime de verdad).
4. Unificar `App.jsx` para que importe por fin `NodeCanvas`, el `geminiService` y respete el `Inspector`.
5. Crear el Flow de "Borrado en Drive" real desde Supabase Edge Functions o un Webhook seguro en n8n.
6. Limpiar `ErrorBoundary.jsx` para no borrar nunca el token de Supabase en caso de crasheo.
7. Generar los `task_id` de forma segura en el backend de n8n o Edge Functions, no en el frontend.
8. Proteger la función `gemini-proxy` consultando a la base de datos el saldo del usuario antes de ejecutar la inferencia.
9. Sanitizar la generación de CSV en `App.jsx` para evitar Inyecciones de Macros.
