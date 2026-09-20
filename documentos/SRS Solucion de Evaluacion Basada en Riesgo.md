# **Reto Julio-Septiembre 2026** 

## **Especificación de Requisitos de Software (SRS)** 

**Sistema PWA para Evaluación Basada en Riesgo (EBR/BPM)** 

**Tipo de Aplicación:** Progressive Web Application (PWA) **Basado en:** Flujo BPM de Evaluación Basada en Riesgo. 

### **1. Introducción** 

### **1.1 Propósito** 

Desarrollar una aplicación web progresiva (PWA) para gestionar el ciclo completo de Evaluaciones Basadas en Riesgo (EBR) de establecimientos sujetos a inspección BPM, permitiendo la planificación, ejecución, seguimiento, evaluación y cierre de procesos de inspección. 

La solución deberá soportar solicitudes iniciadas por empresas, evaluaciones programadas, gestión de alertas sanitarias y atención de denuncias o reportes. 

### **1.2 Alcance** 

La aplicación permitirá: 

- Registro y autenticación de usuarios. 

- Gestión de empresas. 

- Gestión de solicitudes BPM. 

- Gestión de evaluaciones basadas en riesgo.* 

- Planificación de inspecciones. 

- Captura de hallazgos en campo. 

- Cálculo automático del nivel de riesgo. 

- Gestión documental. 

- Generación de informes. 

- Monitoreo mediante tableros de control. 

- Consulta histórica. 

- Funcionamiento offline mediante capacidades PWA. 

_* Se entregará un script con la estructura de las preguntas, y la puntuación de las preguntas._ 

### **2. Roles del Sistema** 

|**Rol**|**Descripción**|
|---|---|
|Administrador|Configura catálogos, parámetros y usuarios|
|Administrador Empresa|Gestiona solicitudes de la empresa|
|Usuario Delegado|Actúa en representación de la empresa|
|Coordinador|Asigna evaluaciones y revisa informes|
|Técnico Evaluador|Realiza evaluaciones e inspecciones|



### **3. Requisitos Funcionales** 

### **RF-01 Gestión de Autenticación** 

El sistema deberá permitir: 

- Inicio de sesión. 

- Recuperación de contraseña. 

- Cambio de contraseña. 

- Cierre de sesión. 

- Doble factor de autenticación (opcional). 

Campos: 

- Usuario 

- Contraseña 

### **RF-02 Registro de Usuarios** 

El sistema permitirá registrar: 

- Administradores de Empresas. 

- Usuarios Delegados. 

Datos: 

- Nombre completo 

- Cédula/Pasaporte 

- Correo electrónico 

- Teléfono 

- Contraseña 

### Adjuntos: 

- Carta de autorización 

Estados: 

- Pendiente Validación 

- Aprobado 

- Rechazado 

### **RF-03 Gestión de Empresas** 

Permitir: 

- Registrar empresa. 

- Editar información. 

- Consultar historial. 

- Consultar evaluaciones previas. 

Campos: 

- Razón Social 

- RNC 

- Nombre Comercial 

- Dirección 

- Municipio 

- Provincia 

- Teléfono 

- Correo 

- Actividad económica 

Representantes: 

- Legal 

- Calidad 

- Contacto principal 

### **RF-04 Dashboard** 

### **Dashboard Empresa** 

Visualizar: 

- Nueva Solicitud BPM 

- Mis Solicitudes 

- Evaluaciones 

- Notificaciones 

### **Dashboard Coordinador** 

Visualizar: 

- Casos pendientes 

- Evaluaciones programadas 

- Alertas LAPCH 

- Denuncias 

- Asignaciones pendientes 

### **Dashboard Técnico** 

Visualizar: 

- Evaluaciones asignadas 

- Calendario 

- Pendientes de informe 

### **RF-05 Solicitudes BPM** 

Permitir crear solicitudes. 

Datos: 

- Empresa 

- Tipo de establecimiento 

- Motivo 

- Observaciones 

Adjuntos: 

- Documentación obligatoria 

Acciones: 

- Guardar borrador 

- Enviar 

Estado inicial: 

- Pendiente de Asignación 

### **RF-06 Gestión de Casos** 

El sistema permitirá originar evaluaciones por: 

**Escenario 1** 

Solicitud de empresa. 

**Escenario 2** 

Programación institucional. 

### **Escenario 3** 

Alerta LAPCH. 

**Escenario 4** 

Reporte o denuncia. 

### **RF-07 Programación de Evaluaciones** 

Permitir: 

- Programar evaluación 

- Reprogramar 

- Cancelar 

Campos: 

- Empresa 

- Fecha 

- Motivo 

- Prioridad 

- Observaciones 

### **RF-08 Gestión de Alertas LAPCH** 

Registrar: 

- Número alerta 

- Fecha 

- Producto 

- Empresa 

- Descripción 

Resultado: 

- Procede evaluación 

- No procede 

Acciones: 

- Registrar 

- Generar evaluación 

- Cerrar caso 

### **RF-09 Gestión de Denuncias** 

Registrar: 

- Tipo denuncia 

- Fecha recepción 

- Denunciante 

- Descripción 

Resultado: 

- Procede 

- No procede 

- Remisión a otro proceso 

### **RF-10 Asignación de Evaluador** 

El Coordinador podrá: 

- Asignar evaluador. 

- Reasignar evaluador. 

Información: 

- Solicitud 

- Empresa 

- Prioridad 

- Tipo de caso 

### **RF-11 Calendario del Evaluador** 

### Vista: 

- Día 

- Semana 

- Mes 

Mostrar: 

- Empresa 

- Dirección 

- Fecha 

- Estado 

### **RF-12 Ejecución de Evaluación** 

Permitir al técnico capturar: 

- Información general 

- Datos de planta 

- Procesos 

- Personal 

- Infraestructura 

- Documentación 

### Acciones: 

- Iniciar 

- Guardar avance 

- Finalizar 

### **RF-13 Formulario de Evaluación Basada en Riesgo** 

Cada criterio deberá ser evaluado mediante: 

- Cumple 

- No Cumple 

- No Aplica 

Campos: 

- Observaciones 

- Evidencias fotográficas 

- Comentarios 

Secciones: 

- Instalaciones 

- Equipos 

- Personal 

- Higiene 

- Producción 

- Almacenamiento 

- Transporte 

- Control de Calidad 

### **RF-14 Motor de Riesgo** 

El sistema deberá calcular automáticamente: 

- Puntaje obtenido. 

- Porcentaje de cumplimiento. 

- Nivel de riesgo. 

### Clasificación del Riesgo: 



<!-- Start of picture text -->
Matriz de Frecuencia de Inspeccién<br>Riesgo Total Nivel de Riesgo Frecuencia de inspeccién<br><!-- End of picture text -->

### **RF-15 Captura de Evidencias** 

### Permitir: 

   - Tomar fotografías. 

   - Adjuntar documentos. 

   - Adjuntar videos cortos. 

- Geolocalización opcional. 

- Modo offline habilitado. 

### **RF-16 Informe de Evaluación** 

Generar automáticamente: 

- Resumen ejecutivo. 

- Hallazgos. 

- No conformidades. 

- Recomendaciones. 

Adjuntos: 

- Fotografías. 

- Documentos. 

### **RF-17 Revisión del Coordinador** 

### Acciones: 

- Aprobar. 

- Devolver. 

- Solicitar corrección. 

Restricción: 

Los datos de la evaluación quedarán bloqueados después de enviada. 

### **RF-18 Gestión de Correcciones** 

El evaluador podrá: 

- Ver observaciones. 

- Corregir informe. 

- Reenviar. 

### **RF-19 Cierre de Expediente** 

Generar: 

- Resultado final. 

- Fecha de cierre. 

- Informe oficial. 

Acciones: 

- Descargar PDF. 

- Emitir informe. 

- Cerrar expediente. 

### **RF-20 Consulta Histórica** 

Permitir búsqueda por: 

- Empresa 

- Solicitud 

- Evaluación 

- Fecha 

- Estado 

Visualización: 

- Historial 

- Informes 

- Calificaciones 

### **4. Requisitos No Funcionales** 

### **RNF-01 PWA** 

La solución deberá: 

- Instalarse en móvil y escritorio. 

- Funcionar sin conexión. 

- Sincronizar cuando exista internet. 

### **RNF-02 Seguridad** 

- JWT. 

- Control RBAC por roles. 

### **RNF-05 Compatibilidad** 

Navegadores: 

- Chrome 

- Edge 

- Firefox 

- Safari 

Dispositivos: 

- Android 

- iOS 

- Windows 

- macOS 

### **5. Integraciones** 

### **Integraciones Externas (Opcional para A+)** 

- Sistema de correo. 

- Servicio de SMS. 

- Firma electrónica. 

- Servicios GIS y geolocalización. 

- Repositorio documental. 

### **6. Arquitectura Propuesta** 

### **Frontend** 

- JavaScript o TypeScript 

- PWA 

- Material Design 

### **Backend** 

- .NET 9 Web API, Entity Framework Core, API REST 

- NodeJs, Express, API REST 

### **Base de Datos** 

- PostgreSQL, MySQL 

