# PrevenciónPro Chile

PWA multi-rubro para la gestión de Prevención de Riesgos Laborales bajo Ley 16.744, DS 40, DS 594, DS 67 y Protocolos MINSAL.

## Uso

```bash
npm install
npm run dev       # desarrollo
npm run build     # verificación TypeScript + build de producción (dist/)
npm run preview   # sirve dist/ (service worker activo → instalable/offline)
```

## Características

- **Selector de empresa/rubro** (cabecera): 3 empresas demo precargadas (Panificadora, Packing exportador, Constructora) o empresa propia desde cero.
- **Selector de perfil**: Prevencionista (administración total), Gerencia (KPIs, costos, aprobación de planes), Supervisor (operación móvil con botones grandes).
- **Dashboard**: contador en vivo de días sin accidentes CTP, calculadora de Tasa de Accidentabilidad / IF / IG / siniestralidad DS 67, proyección de cotización DS 110 vs DS 67, gráficos Recharts, alertas y vencimientos, cumplimiento por supervisor y reporte ejecutivo PDF.
- **Charlas 5 min, Capacitaciones y ODI** con biblioteca por rubro, RUT con validación módulo 11, firma táctil y Acta Legal PDF.
- **Inspecciones**: DS 594, Maquinaria/Vehículos y AST (Cumple / No Cumple / N/A) con creación inmediata de hallazgos (foto base64, criticidad, responsable, plazo) + control de extintores.
- **Hallazgos y planes de acción** con aprobación gerencial y cierre verificado.
- **Incidentes**: reporte rápido (<30 s) e investigación 5 Porqués con causas inmediatas/básicas, medidas y cierre formal (PDF).
- **EPP** por trabajador con vida útil, reposición y firma de recepción (PDF).
- **Matriz IPER** con VEP = P × C, mapa de calor y jerarquía de controles (PDF).
- **Protocolos MINSAL**: TMERT, MMC, PREXOR, PLANESI, Psicosocial / Ley Karin en semáforo.
- **Temas visuales** (Configuración): Industrial Slate, Modo Oscuro Terreno (cámaras de frío / turno noche) y Verde Seguridad HSE; persistidos en `localStorage`.
- **Plantillas y Documentos**: editor por categoría (Charla 5 Min, Entrega EPP, ODI / Inducción, Procedimiento, Amonestación) con variables `{{NOMBRE_TRABAJADOR}}`, `{{RUT_TRABAJADOR}}`, `{{CARGO}}`, `{{EMPRESA}}`, `{{RUT_EMPRESA}}`, `{{AREA}}`, `{{FECHA}}`, `{{RELATOR}}`, `{{TEMA}}`… vista previa en vivo, firma táctil y PDF.
- **Sesiones de firma**: el relator firma una sola vez (firma reutilizable por dispositivo), QR de sesión (`qrcode.react`) y **Modo Kiosco** a pantalla completa para pasar el equipo trabajador por trabajador.
- **Actas verificables**: cada acta/documento lleva QR en el pie de cada página, ID de sesión, fecha-hora exacta de cierre, sello SHA-256 sobre contenido + firmas, firma del relator y tabla consolidada de firmantes (hora exacta y huella de cada firma). El QR abre `#/verificar`, que detecta alteraciones. Exportación de asistencia a CSV (Excel es-CL, separador `;`).
- **Configuración**: datos de empresa, áreas, supervisores, exportar/importar respaldo JSON, restaurar demo.

Persistencia local en `localStorage` (clave `prevencionpro-chile:v1`, esquema v2 con migración automática desde v1).

> Nota: sin backend, el QR de verificación es autocontenido (sesión, fecha-hora, relator, n° firmantes y prefijo del sello). La validación criptográfica completa se realiza en el dispositivo que tiene el registro o importando su respaldo JSON.

## Arquitectura

```
src/
  types/            Modelo de dominio
  data/             Catálogos normativos y empresas demo
  services/         Store (React context), almacenamiento, alertas
  utils/            RUT, fechas, indicadores legales, permisos, pdfGenerator.ts
  components/
    layout/         AppShell (sidebar colapsable, cabecera, nav inferior móvil)
    ui/             Componentes base + SignaturePad
    modules/        Un directorio por módulo funcional
public/             manifest.json, sw.js, íconos
```
