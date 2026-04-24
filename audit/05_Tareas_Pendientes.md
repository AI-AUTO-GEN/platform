# Tareas Pendientes y Roadmap Técnico

- [ ] **Despliegue de Interfaz del "Director Pipeline"**: Conectar el servicio existente de Gemini (`generateScript`, `generateShotlist`, `assistShot`) a la interfaz de usuario en React. Crear el panel donde el usuario introduce su idea, aprueba el guion y genera automáticamente las tarjetas de planos (shots) y entidades (Personajes/Props).
- [ ] **QA y Testing de Usuario**: Navegar por la versión desplegada en Surge, intentar romper la interfaz, comprobar el flujo de generación, los fallos de red y los cambios de proyectos.
- [ ] **Gestión de Assets y Comparador**: Mejorar la UI del panel de "Assets" (Personajes, Props, Entornos) para que no sea solo de lectura, y testear a fondo la vista de "Compare" con resultados generados en masa.
- [ ] **Pasarela de Pago (Stripe)**: Transicionar del sistema actual de recarga de fondos en desarrollo (`dev_add_funds`) a un flujo de Stripe Checkout real, conectando el webhook de Stripe a Supabase para recargar los wallets de los usuarios.
- [ ] **Exportaciones Avanzadas**: Implementar la generación nativa de PDF o ZIP de los contratos, además de refinar el export actual a CSV para Adobe Premiere Pro.
