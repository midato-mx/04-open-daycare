# Open Daycare

Aplicación de guardería (daycare) construida con [Next.js 16.3](https://nextjs.org) (App Router), React 19, Tailwind v4 y TypeScript strict. El backend es [Supabase](https://supabase.com) (Postgres, Auth con RLS) y los correos se envían con [Resend](https://resend.com).

Rutas implementadas: `/` (feed), `/login`, `/activate-account`, `/kids` y `/kids/[id]`. El estado real de cada funcionalidad vive en [`specs/`](specs/).

## Requisitos previos

- Node.js 20+ (probado con Node 24) y npm.
- Docker (solo si vas a correr el stack de Supabase en local).
- Cuenta en [Supabase](https://supabase.com/dashboard) para el proyecto en la nube, el CLI y el MCP.
- Cuenta en [Resend](https://resend.com) si vas a probar el envío de invitaciones.

## Instalación

```bash
npm install
```

## Variables de entorno

Copia la plantilla y edita los valores:

```bash
cp .env.example .env
```

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase (Settings → API). |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave *publishable* (antes `anon`) del proyecto. |
| `NEXT_PUBLIC_APP_URL` | URL base de la app para los links de los correos (p. ej. `http://localhost:3000`). |
| `RESEND_API_KEY` | API key de Resend para enviar correos. |
| `RESEND_FROM_EMAIL` | Remitente de los correos. |
| `SUPABASE_DB_URL` | URL de conexión a Postgres (entorno local de desarrollo). |
| `SUPABASE_DB_PASSWORD` | Contraseña de esa base de datos. |

Los archivos `.env*` están ignorados por Git (solo se versiona `.env.example`). Nunca subas secretos al repositorio.

Para el seed de guarderías demo hay un archivo aparte, `.env.daycare.local`, con `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y las credenciales `DAYCARE_SEED_EMAIL_N` / `DAYCARE_SEED_PASSWORD_N`. El detalle está en [`scripts/README.md`](scripts/README.md).

## Supabase

### Proyecto en la nube

1. Crea un proyecto en el [dashboard de Supabase](https://supabase.com/dashboard).
2. Copia la URL y la clave *publishable* a `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Aplica las migraciones: `npx supabase db push` (requiere login, ver más abajo).

### Stack local (opcional)

El stack local (Postgres 17, Auth, Realtime, Storage, Studio) está configurado en [`supabase/config.toml`](supabase/config.toml):

```bash
npx supabase start      # levanta el stack (requiere Docker)
npx supabase status     # muestra URLs y puertos
npx supabase stop       # lo detiene
```

Puertos por defecto: API `54321`, base de datos `54322`, Studio `54323` (`http://127.0.0.1:54323`) y servidor de correo local `54324`.

### Migraciones y seeds

- Las migraciones versionadas están en `supabase/migrations/` y se aplican con `npx supabase db push`.
- `npx supabase db reset` recrea la base local aplicando migraciones + `supabase/seeders/*.sql`.
- Nueva migración: `npx supabase migration new <nombre>`.
- Seed de guarderías demo (explícito, no corre con las migraciones): `npm run seed:daycare` → ver [`scripts/README.md`](scripts/README.md).

## Levantar el proyecto

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). La página se recarga en caliente al editar archivos de `app/`.

Otros comandos:

```bash
npm run build   # build de producción
npm run start   # sirve el build de producción
npm run lint    # ver nota abajo
```

> **Nota de lint:** `npm run lint` falla con 2 errores heredados en `references/pantallas/support.js` (archivo generado). Para verificar solo el código de la app usa `npx eslint app/` y `npx tsc --noEmit`.

## Autenticación con Supabase (CLI y MCP)

Usamos dos cosas distintas que comparten la misma cuenta Supabase:

- **CLI de Supabase** (`npx supabase ...`): migraciones, links de proyecto, seeds y gestión.
- **MCP remoto de Supabase** (`https://mcp.supabase.com/mcp`): lo consume OpenCode para consultar docs, base de datos, debugging, funciones y branching desde el agente.

### 1. Login del CLI de Supabase

Instala el CLI como devDependency (o con `brew install supabase/tap/supabase`):

```bash
npm install -D supabase
```

Autenticación interactiva (abre el navegador y apruebas con tu cuenta Supabase):

```bash
npx supabase login
npx supabase projects list   # verifica que el login quedó guardado
```

Autenticación sin navegador (CI o entornos sin navegador), con un [personal access token](https://supabase.com/dashboard/account/tokens) con permisos mínimos:

```bash
npx supabase login --token "$SUPABASE_ACCESS_TOKEN"
```

Si exportas `SUPABASE_ACCESS_TOKEN` en el entorno, tiene prioridad sobre cualquier login guardado. Para salir:

```bash
npx supabase logout
```

Vincula el repositorio al proyecto en la nube (una sola vez por máquina):

```bash
npx supabase link --project-ref lcbmchkaroygmtzdkvjk
```

### 2. Autenticar al equipo

Cada integrante se autentica **con su propia cuenta Supabase**; los tokens no se comparten:

1. Cada quien ejecuta `npx supabase login` en su máquina (o genera su propio PAT en https://supabase.com/dashboard/account/tokens).
2. El acceso al proyecto se otorga por rol en el dashboard: **Project Settings → Members** (o *Organization Settings → Members* para todo el org). Agrega a cada persona con el rol que necesite (Owner, Developer, Analyst…).
3. En CI/CD se usa un PAT de servicio configurado como secreto `SUPABASE_ACCESS_TOKEN`; nunca se commitea.

### 3. MCP de Supabase en OpenCode

El MCP está configurado a nivel global en `~/.config/opencode/opencode.jsonc`:

```jsonc
"supabase": {
  "type": "remote",
  "url": "https://mcp.supabase.com/mcp?project_ref=lcbmchkaroygmtzdkvjk&features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions%2Cbranching",
  "enabled": true
}
```

Autenticación (flujo OAuth en el navegador, una por persona):

```bash
opencode mcp auth supabase     # abre el navegador para autorizar
opencode mcp list              # verifica que aparezca conectado
opencode mcp logout supabase   # cierra la sesión OAuth guardada
```

Cada miembro del equipo repite `opencode mcp auth supabase` con **su propia cuenta Supabase**. El acceso a datos lo sigue gobernando el rol que tenga en el proyecto dentro del dashboard: el MCP no otorga permisos por sí solo.

En CI, donde no hay navegador, se autentica con el PAT en el header Authorization:

```jsonc
{
  "mcp": {
    "supabase": {
      "type": "remote",
      "url": "https://mcp.supabase.com/mcp?project_ref=${SUPABASE_PROJECT_REF}",
      "headers": { "Authorization": "Bearer ${SUPABASE_ACCESS_TOKEN}" },
      "enabled": true
    }
  }
}
```

## Estructura

```text
app/                  # App Router (rutas, componentes, layouts)
utils/supabase/       # clientes Supabase (server, client, middleware)
utils/email/          # plantillas y envío con Resend
supabase/             # migraciones, seeders y tests SQL (RLS)
scripts/              # seeds administrativos (ver scripts/README.md)
specs/                # especificaciones y su estado de implementación
references/           # mockups y screenshots de diseño (fuente de verdad visual)
```

## Verificación

```bash
npx tsc --noEmit      # tipos
npx eslint app/       # lint del código de la app
```
