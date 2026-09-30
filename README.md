# Registro de Horas — IMR Consulting (Humand)

Sistema web para que los consultores de **IMR Consulting** registren las horas que dedican a cada proyecto de cada cliente, para que sus supervisores las aprueben y para que administración obtenga los reportes y el archivo de nómina.

## ¿De qué se trata?

IMR es una consultora: su gente trabaja para varios clientes (YPF, Pluspetrol, Tecpetrol, Telecom, Saint Gobain, entre otros) y además dedica tiempo a tareas internas (licencias, capacitación, feriados). IMR necesita saber **cuántas horas dedicó cada persona a cada proyecto**, porque con eso arma la liquidación de sueldos y la facturación a los clientes.

Antes se hacía con planillas manuales. Este sistema las reemplaza: cada consultor carga sus horas, el supervisor las revisa y aprueba, y administración descarga los reportes y el archivo listo para subir al sistema de nómina.

## Quién hace qué

| Rol | Qué hace | Dónde |
|---|---|---|
| **Consultor** | Entra con su email de Humand, elige el proyecto entre "Mis proyectos asignados" y carga sus horas. Ve sus totales por día, puede copiar los proyectos de la semana anterior y mira sus propias horas en **Mi reporte** (con descarga a Excel). | `/` |
| **Supervisor** | Revisa, edita y aprueba las horas de su equipo. | `/admin.html` |
| **Administración** | Crea y mantiene los proyectos y clientes, carga los legajos, arma reportes (por cliente, proyecto o persona) y genera el archivo de nómina. | `/admin.html` |

- Un consultor **solo puede cargar horas en proyectos que le fueron asignados**. Los proyectos internos de IMR (licencias, capacitación, etc.) están abiertos a todos.
- Los supervisores se identifican a partir de la segmentación de Humand ("Supervisores" y "Gerencia").
- La sesión dura 8 horas. No se pueden cargar horas anteriores al 01/07/2026.
- Cuando una solicitud se aprueba o se elimina, se avisa al colaborador (por mensaje en el muro de Humand y/o por email).

## Conceptos clave

- **Cliente:** la empresa para la que trabaja IMR (por ejemplo YPF). IMR también figura como cliente para los proyectos internos.
- **Proyecto:** un trabajo concreto para un cliente. Tiene número y nombre, división, tipo de contrato (**CO / COU**), si es facturable, una fecha de cierre y las personas asignadas. Los proyectos vencidos se cierran solos.
- **Legajo:** el número del empleado en la nómina. El sistema relaciona el email de Humand con el legajo para poder armar el archivo de sueldos.
- **Los proyectos se identifican por número, no por nombre:** si se renombra un proyecto, sus horas anteriores siguen agrupadas en el mismo. Del mismo modo, los reportes agrupan a las personas por su ID de empleado, así que un cambio de nombre o apellido no las parte en dos.

## Reportes y archivo de nómina

- **Reportes** filtrables por cliente, proyecto y persona, exportables a Excel.
- **Export de nómina:** genera un `.csv` con el formato de la plantilla de IMR (`PF_PlantillaRegTiempos`), con el legajo de cada persona, que se sube al sistema de nómina **SAW**. También descarga un Excel de respaldo con las columnas como texto.
- Antes de descargar hay una vista previa en pantalla, con un aviso si alguien no tiene legajo cargado.

### ⚠️ Cosas que aprendimos con SAW (leer antes de tocar el export)
- SAW **solo acepta `.csv`**, no `.xlsx`.
- La **fecha va como `DD/MM/AAAA`**. La pantalla de carga de SAW puede *mostrarla* invertida, pero al procesar el archivo la toma bien. Se probó `MM/DD/AAAA` y SAW dejó de reconocer las filas: no volver a cambiarlo.
- El `.csv` hay que subirlo **tal cual**, sin abrirlo ni guardarlo desde Excel: Excel reescribe las fechas y los números.

## Dónde está y cómo se despliega

- **Producción:** https://registro-horas-imr.vercel.app (panel: `/admin.html`). También responde `registro-horas-nuevo-cliente.vercel.app`.
- **Vercel:** proyecto `registro-horas-imr` (cuenta `silviorodriguez-1520s-projects`). Cada push a `main` despliega automáticamente.
- **Repo:** `silviorodriguez-web/registro-horas-nuevo-cliente` (privado).
- **Conexión con Humand:** usa la API key de la comunidad de IMR.

> **Nota sobre las URLs:** `registro-horas-imr.vercel.app` es un alias fijado a mano a un deployment concreto; **no se actualiza solo con los deploys nuevos**. Después de un deploy a producción hay que apuntarlo al nuevo deployment:
> `vercel alias set <url-del-deployment> registro-horas-imr.vercel.app`
> (`registro-horas-nuevo-cliente.vercel.app` sí sigue a `main` automáticamente). El 30/09/2026 se alineó el alias con el deployment del commit `e3ab9f3`.
> Además, el panel es `/admin.html` (o `/admin`) **sin espacios al final**: un `%20` detrás de la URL muestra la pantalla de colaboradores.

## Estructura técnica

```
registro-horas-nuevo-cliente/
├── api/
│   ├── humand.js        ← proxy hacia la API de Humand (la API key vive en Vercel)
│   ├── submissions.js   ← registros de horas (Postgres/Neon, tabla `submissions`)
│   ├── projects.js      ← clientes y proyectos (Postgres/Neon, tabla `projects`)
│   ├── legajos.js       ← relación email → legajo (Postgres/Neon, tabla `legajos`)
│   ├── notify.js        ← envío de emails (Resend)
│   └── _db.js           ← conexión compartida a Neon
├── public/
│   ├── index.html       ← carga de horas y "Mi reporte" (consultores)
│   └── admin.html       ← panel de supervisión y administración
├── vercel.json          ← rutas: /admin, /api/*, resto → index.html
└── package.json
```

### Variables de entorno (Vercel → Project Settings → Environment Variables)

| Variable | Para qué |
|---|---|
| `HUMAND_API_KEY` | API key de la comunidad de IMR en Humand (formato base64 `instanceId:token`, se envía como `Authorization: Basic <key>`) |
| `DATABASE_URL` | Cadena de conexión a la base Postgres (Neon) |
| `RESEND_API_KEY` | Envío de emails desde `api/notify.js` |

**Nunca** escribir valores reales en el repo (ni en este README). `.env*` está en `.gitignore`.

### Desarrollo local
```bash
npm install -g vercel
vercel link            # vincular al proyecto `registro-horas-imr`
vercel env pull        # baja las variables a .env.local (ignorado por git)
vercel dev             # http://localhost:3000
```

## Puntos de atención
- **Hay otros despliegues de registro de horas** en la misma cuenta de Vercel, cada uno con su propia comunidad de Humand (por ejemplo `registro-horas` → República Microfinanzas y `registro-horas-v5` → Apiwan). Antes de investigar un reclamo, confirmar que se está mirando el de IMR.
- `api/humand.js`, `api/submissions.js`, `api/projects.js` y `api/legajos.js` responden con CORS abierto y sin autenticación propia: cualquiera que conozca la URL puede consultarlos. Conviene protegerlos o restringir las rutas permitidas.
- Los datos contienen nombres, emails y legajos de empleados: no exponer el repo ni los exports públicamente.
- Las cuentas de usuarios y los permisos dependen de Humand (segmentaciones "Supervisores" y "Gerencia"); si alguien no ve lo que debería, revisar primero su segmentación allí.
- Herramienta relacionada (no vive en este repo): un corrector de recibos de sueldo en PDF para IMR (arregla fuentes y agrega texto por OCR para que Humand pueda leerlos).
