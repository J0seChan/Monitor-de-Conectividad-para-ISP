# Monitor ISP

Aplicación web (PWA) interna para el monitoreo en tiempo real del estado de conectividad de los clientes de un proveedor de servicios de internet (ISP), a partir del estado real de sus sesiones PPPoE en equipos MikroTik.

Desarrollado como parte de una residencia profesional para **Link Redes** (Tecnología Salazar Ramos S.A. de C.V.).

---

## ¿Qué hace?

- **Monitorea en tiempo real** qué clientes están conectados, desconectados o suspendidos, consultando directamente las sesiones PPPoE del MikroTik (no depende de ping/ICMP).
- **Distingue** entre un cliente caído (falla de red) y uno suspendido (cuenta deshabilitada, p. ej. por falta de pago).
- **Detecta clientes con conexión inestable**, contando sus cambios de estado en las últimas 24 horas.
- **Detecta posibles cortes de infraestructura**, agrupando a los clientes por zona y número de puerto PON: si varios clientes del mismo PON caen a la vez, lo señala como probable corte de fibra en lugar de fallas individuales.
- **Dashboard** con gráfica interactiva (filtra la tabla al tocar un estado), filtro por zona, y formulario de alta de clientes protegido por inicio de sesión.

---

## Arquitectura

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  MikroTik (API) │◄────│ Worker Python│────►│    Supabase     │
│  sesiones PPPoE │     │  (cada 60s)  │     │ Postgres + API  │
└─────────────────┘     └──────────────┘     └────────┬────────┘
                                                       │
                                              ┌────────▼────────┐
                                              │  Dashboard PWA  │
                                              │  (GitHub Pages) │
                                              └─────────────────┘
```

- **Worker (Python):** consulta el estado de las sesiones y lo escribe en Supabase. Incluye un **modo de simulación** para desarrollar y probar sin conectarse al MikroTik de producción.
- **Supabase:** base de datos PostgreSQL con API REST y autenticación. La seguridad recae en políticas RLS que exigen sesión iniciada.
- **Frontend:** HTML + CSS + JavaScript (Chart.js, Tailwind vía CDN, supabase-js). Estático, alojado en GitHub Pages.

---

## Estructura de este repositorio (frontend)

```
.
├── index.html              # Página principal del dashboard
├── assets/
│   ├── css/
│   │   └── style.css       # Estilos propios
│   └── js/
│       ├── config.js       # Credenciales de Supabase (editar antes de usar)
│       └── app.js          # Lógica del dashboard
├── .gitignore
└── README.md
```

### El worker se mantiene fuera de este repositorio

El componente que recolecta los datos (worker en Python) **no forma parte de este repositorio público**, por seguridad: se conecta a Supabase con la clave `service_role` (acceso total), que nunca debe quedar expuesta en internet. El worker vive únicamente en el servidor donde se ejecuta (y, de versionarse, en un repositorio privado aparte). Sus archivos son:

```
worker.py               # Recolector de estados (escribe en Supabase)
simulador_mikrotik.py   # Fuente de datos simulada para desarrollo
.env                    # Credenciales reales — NUNCA se sube a ningún repositorio
```

---

## Seguridad

- La clave `service_role` (acceso total, usada por el worker) se mantiene solo en el backend, mediante variables de entorno; nunca se incluye en el frontend ni en el repositorio.
- El acceso al MikroTik se realiza con un usuario de **solo lectura** (permisos `read` + `api`), a través de un túnel VPN restringido al puerto de la API.
- Todas las tablas están protegidas con Row Level Security (RLS); sin sesión iniciada no se puede leer ni escribir.

---

## Estado del proyecto

Proyecto en desarrollo activo como residencia profesional. Funcionalidades base y de análisis (inestabilidad, corte por PON) implementadas y probadas en modo simulación. Integración con MikroTik de producción y despliegue en servidor en la nube, en proceso.

---

## Licencia y uso

Proyecto desarrollado como parte de una residencia profesional para Link Redes (Tecnología Salazar Ramos S.A. de C.V.). El código se publica con fines de evaluación académica; su uso, copia o distribución están sujetos a autorización de las partes involucradas. Todos los derechos reservados.
