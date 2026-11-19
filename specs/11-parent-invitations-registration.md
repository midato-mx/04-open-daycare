# SPEC 11 — Invitaciones, registro y vinculación de padres

> **Status:** Approved
> **Depends on:** SPEC 05, SPEC 08, SPEC 09, SPEC 10
> **Date:** 2026-11-17
> **Objective:** Implementar el flujo completo para invitar a un padre, registrarlo mediante un código enviado por correo y vincularlo de forma segura con el niño correspondiente.

## Why this spec exists

El diálogo «Vincular padre» ya existe como una experiencia visual sin persistencia. Esta spec convierte ese flujo en una operación real de onboarding, sin exponer credenciales ni permitir que un padre consulte niños ajenos.

## Scope

**In:**

- Registrar todos los cambios de base de datos en una migración SQL nueva dentro de `supabase/migrations/`.
- Crear y persistir invitaciones desde el perfil de un niño.
- Generar códigos aleatorios alfanuméricos de exactamente 5 caracteres.
- Hacer que cada invitación expire 24 horas después de su creación.
- Enviar la invitación desde el servidor de Next.js mediante el paquete `resend`.
- Configurar el remitente, la URL pública y la API key mediante variables de entorno.
- Incluir en el correo el nombre del padre, el nombre del niño, el código y un enlace a `/activate-account?code=...`.
- Reutilizar una invitación pendiente del mismo correo y niño, regenerando código y expiración.
- Mostrar el estado `PENDIENTE` en el perfil del niño después de un envío exitoso.
- Validar el código y el correo durante la activación.
- Registrar al padre mediante `supabase.auth.signUp` con contraseña.
- Mantener activa la confirmación de correo de Supabase.
- Completar la invitación después de la confirmación del correo.
- Crear el registro `parent_child` con el parentesco seleccionado.
- Redirigir al padre al feed filtrado por los niños vinculados.
- Permitir que el padre consulte únicamente publicaciones de sus niños vinculados.
- Aplicar RLS y validaciones del servidor para separar staff, padres y daycares.
- Cubrir el flujo con pruebas SQL, verificación de tipos, lint y revisión visual.

**Out of scope (para specs futuros):**

- Recuperación, cambio o administración de contraseñas.
- Invitaciones masivas.
- Envío de SMS, WhatsApp o canales distintos de correo.
- Plantillas editables por el daycare.
- Reenvío automático programado.
- Administración de padres desde una pantalla separada.
- Desvincular o eliminar padres.
- Vincular manualmente una cuenta existente sin que la persona inicie sesión.
- Cambiar roles, daycares o permisos desde la interfaz.
- Notificaciones posteriores a la aceptación.
- Maquetación mobile dedicada.

## Data model

La migración debe crear los enums y tablas que todavía no existen:

```sql
create type public.relationship_type as enum (
  'father',
  'mother',
  'guardian'
);

create type public.invitation_status as enum (
  'pending',
  'accepted',
  'expired',
  'cancelled'
);

create table public.parent_child (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.user (id) on delete cascade,
  child_id uuid not null references public.child (id) on delete cascade,
  relationship public.relationship_type not null,
  created_at timestamptz not null default now(),
  constraint parent_child_parent_id_child_id_key unique (parent_id, child_id)
);

create table public.invitation (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child (id) on delete cascade,
  invited_by uuid not null references public.user (id) on delete restrict,
  full_name text not null,
  email text not null,
  relationship public.relationship_type not null,
  code text not null unique,
  status public.invitation_status not null default 'pending',
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
```

Reglas adicionales:

- `code` se guarda en mayúsculas y contiene únicamente caracteres alfanuméricos seguros.
- Una invitación es válida solo si `status = 'pending'`, `expires_at > now()` y el código coincide con el correo.
- Una invitación expirada debe tratarse como `expired` antes de aceptar otra operación.
- El correo se normaliza a minúsculas antes de comparar o guardar.
- `relationship` usa `father`, `mother` o `guardian`; la UI conserva las etiquetas «Papá», «Mamá» y «Tutor/a».
- El registro `parent_child` se crea una sola vez por combinación de `parent_id` y `child_id`.
- El perfil creado por el trigger de `auth.users` recibe `role = 'parent'`, `daycare_id` del niño y `full_name` de la invitación.

El estado temporal de las pantallas debe representar:

```ts
type InvitationFormInput = {
  fullName: string;
  email: string;
  relationship: "father" | "mother" | "guardian";
  childId: string;
};

type InvitationState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "sent"; invitationId: string }
  | { status: "error"; message: string };

type ActivationInput = {
  code: string;
  email: string;
  password: string;
  photoConsent: boolean;
};
```

## Implementation plan

1. Crear una migración SQL nueva dentro de `supabase/migrations/` para `relationship_type`, `invitation_status`, `parent_child` e `invitation`, con índices para código, correo, niño, estado y expiración. Verificar que la migración no cree invitaciones ni vínculos demo.
2. Agregar privilegios mínimos y políticas RLS. Staff/admin podrá crear invitaciones para niños de su daycare y consultar su estado; padres no podrán crear invitaciones; ninguna sesión podrá leer datos de otro daycare.
3. Agregar políticas para `parent_child` y publicaciones que permitan a un padre leer únicamente los niños y publicaciones relacionados mediante vínculos aceptados.
4. Instalar `resend` y documentar en `.env.example` las variables `RESEND_API_KEY`, `RESEND_FROM_EMAIL` y `NEXT_PUBLIC_APP_URL`, sin incluir valores secretos.
5. Crear el servicio de correo del servidor con una plantilla en español mexicano. El correo debe incluir nombre del padre, nombre del niño, código, vigencia de 24 horas y enlace absoluto a `/activate-account?code=...`.
6. Implementar la Server Action de invitación desde `LinkParentDialog`. Debe autenticar al usuario, comprobar rol staff/admin, validar que el niño pertenece a su daycare, crear o reutilizar la invitación pendiente y generar el código antes de enviar.
7. Completar el envío y la persistencia con compensación: si Resend falla, la operación no debe dejar una invitación `pending`; debe cancelar o eliminar el registro y mostrar un error controlado.
8. Actualizar `LinkParentDialog` para enviar datos reales, mostrar carga, errores inline y éxito, y conservar la fidelidad visual. Tras el éxito, el perfil debe mostrar el padre con estado `PENDIENTE`.
9. Actualizar la consulta del perfil del niño para reemplazar los padres estáticos por invitaciones pendientes y vínculos aceptados del daycare autenticado.
10. Convertir `/activate-account` en un formulario real que lea `code` desde la query string, valide código y correo, solicite contraseña y mantenga el consentimiento de fotos.
11. Implementar el registro con `supabase.auth.signUp`, pasando en metadata el `full_name`, `role = parent` y `daycare_id` derivados de la invitación validada. No aceptar `daycare_id`, `child_id` ni `role` provenientes sin validar del navegador.
12. Implementar el callback de confirmación de correo. Debe recuperar la sesión, volver a validar la invitación y crear `parent_child` junto con el cambio de la invitación a `accepted` y `accepted_at`.
13. Manejar correo ya registrado sin crear una segunda cuenta: mostrar un mensaje para iniciar sesión y continuar la aceptación con una sesión correspondiente al correo invitado.
14. Reemplazar el feed estático de `app/page.tsx` por una consulta que distinga staff/admin y parent. Para un padre, la consulta debe usar únicamente `parent_child` aceptado y los niños relacionados.
15. Crear pruebas SQL reproducibles para enums, restricciones, expiración, aislamiento por daycare, permisos staff/admin, rechazo de parent/anónimo y lectura limitada por `parent_child`.
16. Verificar el flujo de extremo a extremo con Resend en modo de prueba y variables locales, y ejecutar `npx tsc --noEmit`, `npx eslint app/` y revisión visual de `/kids/[id]`, `/activate-account` y `/`.

## Acceptance criteria

- [ ] Existe una migración versionada que crea `relationship_type`, `invitation_status`, `parent_child` e `invitation`.
- [ ] `parent_child` impide duplicar el mismo vínculo entre padre y niño.
- [ ] Los códigos generados tienen exactamente 5 caracteres alfanuméricos y se guardan en mayúsculas.
- [ ] Las invitaciones nuevas expiran exactamente 24 horas después de su creación.
- [ ] Una invitación pendiente del mismo correo y niño se reutiliza y recibe código y expiración nuevos.
- [ ] Staff/admin solo puede invitar niños de su daycare.
- [ ] Un padre, una sesión anónima o un usuario de otro daycare no puede crear invitaciones.
- [ ] El correo se envía desde el servidor mediante `resend`.
- [ ] El correo usa `RESEND_API_KEY`, `RESEND_FROM_EMAIL` y `NEXT_PUBLIC_APP_URL` sin valores secretos en el repositorio.
- [ ] El correo contiene nombre del padre, nombre del niño, código, vigencia de 24 horas y enlace de activación.
- [ ] Si Resend falla, no queda una invitación con estado `pending`.
- [ ] El diálogo muestra carga, error controlado y éxito sin exponer detalles técnicos.
- [ ] Después de un envío exitoso, el perfil muestra al padre con estado `PENDIENTE`.
- [ ] `/activate-account?code=...` carga el código recibido y no usa el código estático `7K4P9`.
- [ ] Un código expirado, cancelado, aceptado o inexistente impide el registro y muestra un mensaje en español.
- [ ] El correo de activación debe coincidir con el correo de la invitación.
- [ ] `signUp` crea el usuario con rol `parent`, nombre de la invitación y daycare del niño.
- [ ] El flujo conserva activa la confirmación de correo de Supabase.
- [ ] Después de confirmar el correo, se crea exactamente un registro `parent_child`.
- [ ] Después de aceptar, la invitación cambia a `accepted` y guarda `accepted_at`.
- [ ] Un correo ya registrado no genera una segunda cuenta.
- [ ] Un padre no puede aceptar una invitación usando un correo distinto al invitado.
- [ ] Un padre solo puede consultar niños relacionados por `parent_child`.
- [ ] Un padre solo puede consultar publicaciones de sus niños vinculados.
- [ ] Un padre no puede consultar perfiles, invitaciones o publicaciones de otros daycares.
- [ ] El padre llega al feed filtrado después de completar la aceptación.
- [ ] La UI guarda `father`, `mother` o `guardian` aunque muestre «Papá», «Mamá» o «Tutor/a».
- [ ] Las pruebas SQL cubren accesos permitidos y denegados.
- [ ] `npx tsc --noEmit` termina sin errores.
- [ ] `npx eslint app/` termina sin errores.
- [ ] La comparación visual confirma que el diálogo y la activación conservan el diseño definido, incluyendo carga, error, éxito y código inválido.

## Decisions

- **Sí:** una sola spec para invitación, correo, registro y vínculo. **No:** dividir el flujo en dos specs independientes, porque se aceptó revisar el recorrido completo como una unidad.
- **Sí:** registrar cada cambio de base de datos en una migración versionada dentro de `supabase/migrations/`. **No:** depender de DDL ejecutado manualmente o de cambios remotos sin archivo de control de versiones.
- **Sí:** usar `parent_child` e `invitation` del esquema de referencia. **No:** guardar vínculos en arrays de presentación ni reutilizar `app/lib/data.ts` como persistencia.
- **Sí:** códigos aleatorios alfanuméricos de 5 caracteres. **No:** reutilizar el código demo `7K4P9`.
- **Sí:** expiración de 24 horas. **No:** conservar la expiración visual de 7 días del mockup.
- **Sí:** enviar desde el servidor de Next.js con `resend`. **No:** exponer la API key en componentes cliente ni enviar desde el navegador.
- **Sí:** usar variables de entorno para remitente, URL y API key. **No:** fijar dominios o secretos en el código.
- **Sí:** reutilizar una invitación pendiente para el mismo correo y niño. **No:** acumular invitaciones pendientes duplicadas.
- **Sí:** invalidar la operación si Resend falla. **No:** dejar una invitación pendiente que el usuario no recibió.
- **Sí:** mantener activa la confirmación de correo de Supabase. **No:** desactivar confirmación para simplificar el vínculo.
- **Sí:** aceptar la invitación después de confirmar el correo. **No:** crear un vínculo permanente antes de que exista una sesión confirmada.
- **Sí:** registrar cuentas nuevas con `signUp`. **No:** crear usuarios mediante una API administrativa desde el servidor.
- **Sí:** tratar una cuenta existente como un flujo de inicio de sesión y aceptación. **No:** intentar duplicar la identidad Auth.
- **Sí:** filtrar el feed por `parent_child` aceptado. **No:** mostrar todos los niños del daycare a un padre.
- **Sí:** persistir enums y códigos en inglés. **No:** guardar etiquetas traducidas de la UI en PostgreSQL.
- **Sí:** conservar el modal y la pantalla de activación como superficies principales. **No:** crear una experiencia visual distinta sin necesidad funcional.

## Risks

| Riesgo                                                         | Mitigación                                                                                                           |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Resend acepta el envío pero la respuesta se pierde             | Registrar el resultado de envío y permitir reutilización segura de la invitación sin duplicar vínculos.              |
| Un código corto puede colisionar                               | Usar generación criptográficamente segura, restricción `UNIQUE` y reintento limitado ante conflicto.                 |
| La confirmación de correo interrumpe el contexto de activación | Conservar el código en el enlace de confirmación y volver a validar la invitación al regresar.                       |
| Un usuario manipula `child_id`, `daycare_id` o `role`          | Derivar los valores desde la invitación en el servidor y repetir la autorización con RLS.                            |
| El trigger de `public.user` requiere metadata completa         | Enviar metadata validada desde la invitación y mostrar un error controlado si el perfil no se crea.                  |
| Se intenta aceptar una invitación ya usada                     | Validar estado y expiración dentro de la operación de aceptación; la unicidad del vínculo evita duplicados.          |
| Una cuenta existente pertenece a otro daycare                  | Exigir sesión del correo invitado y rechazar la aceptación si el perfil no coincide con el daycare de la invitación. |
| El feed actual depende de datos estáticos                      | Migrar la consulta de forma explícita y conservar un estado vacío seguro para padres sin publicaciones.              |

## What is **not** in this spec

- Recuperación o cambio de contraseña.
- Invitaciones masivas o plantillas editables.
- SMS, WhatsApp u otros canales.
- Cambios de esquema, RLS, privilegios, triggers o funciones aplicados fuera de una migración versionada.
- Desvincular padres o administrar relaciones existentes.
- Cambiar roles o daycares.
- Notificaciones posteriores a la aceptación.
- Lectura de información de otros niños por parte de un padre.
- Uso del código demo `7K4P9` como código real.
- Maquetación mobile dedicada.
