# Objetivos del Proyecto (Análisis Ejecutivo)

1. **Paridad Diseño-Producción**: Trasladar la alta fidelidad visual de los prototipos V07 a un entorno funcional en React.
2. **Sistema de Nodos/Shots Multimodales**: Permitir a los usuarios generar Imágenes, Video, Audio y 3D bajo una interfaz de "Cartas" unificada.
3. **Control Financiero y Pricing**: Integrar el `PricingEngine` y la base de datos de modelos (FAL AI) para previsualizar costes en tiempo real y trackear el gasto total de la sesión.
4. **Persistencia y Colaboración**: Garantizar que el estado (Shots, Prompts, Configuración) no se pierda al recargar la página, y permitir a los usuarios compartir su trabajo a través de enlaces con permisos granulares.
5. **Generación Continua**: Conectar el frontend a los webhooks de n8n para despachar tareas a los modelos de IA y recibir resultados (imágenes/videos) de manera asíncrona.
