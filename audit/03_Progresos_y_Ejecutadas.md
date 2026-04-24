# Progresos y Tareas Completadas

A lo largo de las últimas sesiones se han ejecutado y validado las siguientes tareas críticas:

- [x] **Rewrite del UI V07**: Creación de la estructura base (`App.jsx`, `index.css`) con el sistema Dark-Studio.
- [x] **Integración Base de Datos de Modelos**: Carga dinámica de los modelos desde la tabla `ai_models` de Supabase.
- [x] **Persistencia de Contratos**: Sistema `persistContract` que actualiza automáticamente la columna `contract` en la tabla `projects` con cada cambio en un shot.
- [x] **Pricing en Tiempo Real**: Función `calculatePreviewCost()` integrada en el botón de Generate. Suma en tiempo real del coste de la sesión en el Dock inferior.
- [x] **Gestor de Proyectos**: Dropdown funcional para cambiar entre proyectos y crear nuevos (vinculados al usuario autenticado).
- [x] **Inspector Dinámico**: Los parámetros de configuración en el inspector ahora se adaptan dinámicamente según el esquema del modelo (ej: ratio de aspecto para imágenes, duración para videos, output para 3D).
- [x] **Backend de Compartición (Share)**: 
    - Tabla `project_shares` creada.
    - RLS (Row Level Security) configurado para proteger accesos.
    - UI del Modal Share vinculada a la DB (Generar Link, Privacidad Pública/Privada, Invitar por Email).
- [x] **Limpieza del Workspace**: Separación estricta entre el código core, los archivos de datos FAL (`supabase/fal_data`), los scripts de n8n (`n8n/`) y las investigaciones (`_RESEARCH_Y_PROTOTIPOS/`).
