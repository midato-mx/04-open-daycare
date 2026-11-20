# SPEC 14 — Publicación real del feed para staff y administración

> **Status:** Implemented
> **Depends on:** SPEC 01, SPEC 06, SPEC 08, SPEC 09, SPEC 11, SPEC 12
> **Date:** 2026-11-19
> **Objective:** Permitir que staff y admin creen, editen y eliminen publicaciones reales del feed desde el sidebar o el compositor inline, con destinatarios por sala o niño e imágenes opcionales persistidas.

## Scope

**In:**

- Convertir `Publicar` del diálogo existente de SPEC 06 de no-op a publicación real.
- Mantener dos accesos al mismo flujo:
  - Botón `Nueva publicación` del sidebar.
  - Compositor `Comparte un momento…` dentro del feed.
- Mostrar el compositor inline únicamente a usuarios con rol `staff` o `admin`.
- Abrir el mismo modal `Nueva publicación` al pulsar el compositor.
- Abrir el modal y activar inmediatamente el selector de archivos al pulsar el ícono de cámara.
- Permitir seleccionar una sala desde las salas del daycare actual.
- No mostrar salas sin niños o sin padres vinculados como destinos publicables.
- Permitir seleccionar toda una sala o uno o varios niños de una sala.
- Entregar una publicación dirigida a un niño a todos sus padres vinculados.
- Crear un anuncio de sala para `Toda la sala`.
- Publicar inmediatamente, sin borradores ni programación.
- Conservar el tipo `Ánimo` agregando `mood` al modelo persistido.
- Mantener los tipos `meal`, `nap`, `activity`, `achievement`, `photo` y `announcement`.
- Permitir hasta 10 imágenes por publicación.
- Aceptar únicamente imágenes JPG, PNG o WebP de hasta 10 MB cada una.
- Persistir las imágenes en un bucket privado de Supabase Storage.
- Guardar la referencia de cada imagen en `public.post_photo`.
- Garantizar que una publicación no quede visible si falla la subida de una imagen o la creación de sus relaciones.
- Mostrar errores accionables y conservar el formulario cuando falle la operación.
- Permitir que el autor edite sala, destinatarios, tipo, descripción e imágenes.
- Permitir que el autor elimine su publicación mediante un diálogo de confirmación.
- Permitir a staff y admin consultar todas las publicaciones del mismo daycare.
- Permitir a staff y admin crear, editar y eliminar únicamente publicaciones propias.
- Mantener el diseño visual y los textos de la referencia existente.

**Out of scope (para specs futuros):**

- Borradores, publicación programada o moderación.
- Notificaciones push, correo o notificaciones dentro de la aplicación.
- Selección explícita de padres como destinatarios independientes de los niños.
- Publicaciones de usuarios con rol `parent`.
- Comentarios, reacciones o métricas nuevas.
- Títulos separados para las publicaciones.
- Eliminación o edición masiva.
- Publicación en salas sin niños o sin padres vinculados.
- Bucket público o URLs de imágenes permanentes expuestas al cliente.
- Maquetación mobile dedicada.
- Cambios al flujo de autenticación o asignación de roles.

## Data model

La feature amplía el modelo existente de publicaciones y agrega persistencia de fotografías.

### Post types

El enum `public.post_type` debe contener:

```sql
('meal', 'nap', 'activity', 'achievement', 'photo', 'announcement', 'mood')
```

La UI conserva estas etiquetas:

```ts
const postTypeLabels = {
  meal: "Comida",
  nap: "Siesta",
  activity: "Actividad",
  achievement: "Logro",
  mood: "Ánimo",
  photo: "Foto",
  announcement: "Anuncio",
} as const;
```

### Existing post relations

Se reutilizan:

- `public.post.author_id`: usuario que creó la publicación.
- `public.post.room_id`: sala destino.
- `public.post.type`: tipo persistido.
- `public.post.body`: descripción.
- `public.post.published_at`: fecha y hora de publicación.
- `public.post_child`: niños destinatarios cuando no se publica a toda la sala.
- `public.parent_child`: relación que determina los padres que reciben una publicación dirigida a un niño.

Reglas de destinatarios:

- `Toda la sala`: `post.room_id` obligatorio, `post.type = 'announcement'` y ninguna fila en `post_child`.
- Niños seleccionados: `post.room_id` obligatorio y una fila `post_child` por niño seleccionado.
- Cada niño seleccionado debe pertenecer a `post.room_id`.
- Solo se pueden seleccionar niños con al menos un padre vinculado activo.

### New `post_photo` relation

Crear `public.post_photo`:

```sql
create table public.post_photo (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.post (id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null,
  byte_size integer not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);
```

Restricciones:

- `mime_type` solo puede ser `image/jpeg`, `image/png` o `image/webp`.
- `byte_size` debe ser mayor que cero y menor o igual a `10485760`.
- `display_order` debe ser no negativo.
- Debe existir un índice por `post_id`.
- Debe habilitarse RLS.

El bucket privado de Storage se llamará `post-media`. Las rutas seguirán este formato:

```text
{daycare_id}/{post_id}/{photo_id}.{extension}
```

El cliente nunca recibe una URL pública permanente. El feed genera URLs firmadas o usa el mecanismo seguro equivalente para mostrar las imágenes autorizadas.

### Server action input

La operación de creación y edición debe validar un input equivalente a:

```ts
type PostAudience =
  | { kind: "room"; roomId: string }
  | { kind: "children"; roomId: string; childIds: string[] };

type PostDraft = {
  audience: PostAudience;
  type:
    | "meal"
    | "nap"
    | "activity"
    | "achievement"
    | "mood"
    | "photo"
    | "announcement";
  body: string;
  photos: File[];
};
```

La validación de autorización y pertenencia al daycare debe ocurrir en el servidor, no solo en el cliente.

## Implementation plan

1. Crear una migración versionada que agregue `mood` a `public.post_type`, cree `public.post_photo`, habilite RLS, agregue índices y configure el bucket privado `post-media` con sus políticas de acceso.
2. Actualizar las políticas de `public.post` y `public.post_child` para que staff y admin puedan consultar publicaciones del mismo daycare, pero solo el `author_id` pueda insertar, actualizar o eliminar su propia publicación.
3. Crear las políticas de `public.post_photo` y `storage.objects` para que solo un autor autorizado pueda gestionar las imágenes de sus publicaciones y que los padres solo puedan leer imágenes de publicaciones visibles para ellos.
4. Crear `supabase/tests/real-feed-publication-rls.sql` para verificar acceso por daycare, autoría, destinatarios por niño, anuncios de sala, imágenes y aislamiento entre usuarios no relacionados.
5. Crear funciones de servidor en `app/feed/actions.ts` para cargar salas y destinatarios válidos, crear publicaciones, editar publicaciones y eliminar publicaciones.
6. Implementar la orquestación de publicación con limpieza compensatoria: validar primero, subir imágenes, crear la publicación y relaciones, y borrar archivos o filas parciales cuando alguna fase falle.
7. Actualizar `app/feed/data.ts` para consultar publicaciones reales, salas, niños relacionados y fotografías autorizadas, incluyendo URLs firmadas de corta duración.
8. Actualizar los tipos de `app/lib/data.ts` y `app/components/FeedPostCard.tsx` para soportar `mood`, galerías de imágenes, audiencia por sala o niños y acciones del autor.
9. Actualizar `app/components/CreatePostDialog.tsx` para cargar salas dinámicas, validar destinatarios válidos, enviar el formulario real, conservarlo ante errores y mostrar estados de carga, éxito y error.
10. Mantener la regla de `Toda la sala` como selección excluyente con niños individuales y forzar `announcement` cuando se publique a la sala completa.
11. Agregar el modo de edición de la publicación propia reutilizando el mismo formulario, incluyendo reemplazo, adición y eliminación de imágenes.
12. Agregar el diálogo de confirmación para eliminar una publicación y eliminar también sus referencias e imágenes.
13. Actualizar `app/(private)/page.tsx` para mostrar el compositor inline a staff y admin, abrir el diálogo compartido y pasar el estado inicial `photos` cuando se pulse la cámara.
14. Verificar visualmente el sidebar, el compositor, el modal, la tarjeta publicada, la edición, la eliminación y los estados de error con Playwright.
15. Ejecutar `npx tsc --noEmit`, `npx eslint app/` y las pruebas SQL de RLS antes de marcar la spec como implementada.

## Acceptance criteria

- [x] El botón `Nueva publicación` del sidebar abre el flujo real sin navegar ni recargar.
- [x] Staff y admin ven el compositor `Comparte un momento…` dentro del feed.
- [x] Parent no ve el compositor ni puede iniciar este flujo.
- [x] Pulsar el compositor abre el mismo modal `Nueva publicación`.
- [x] Pulsar la cámara abre el mismo modal y activa inmediatamente la selección de archivos.
- [x] El selector de sala solo muestra salas del daycare actual con niños y padres vinculados.
- [x] La selección de una sala limita los niños disponibles a esa sala.
- [x] `Toda la sala` es excluyente con la selección individual de niños.
- [x] Una publicación de sala se guarda con `type = announcement`, `room_id` válido y sin filas `post_child`.
- [x] Una publicación dirigida a niños crea exactamente una fila `post_child` por niño elegido.
- [x] Un niño seleccionado pertenece a la sala seleccionada antes de guardar.
- [x] Un padre vinculado activo puede ver una publicación dirigida a su niño.
- [x] Un padre no puede ver una publicación dirigida a un niño no vinculado.
- [x] Un padre vinculado a la sala puede ver un anuncio de esa sala.
- [x] Staff y admin pueden consultar publicaciones del mismo daycare aunque no sean autores.
- [x] Staff y admin no pueden editar ni eliminar publicaciones ajenas.
- [x] El autor puede editar sala, destinatarios, tipo, descripción y fotografías.
- [x] El autor puede eliminar su publicación desde un diálogo de confirmación.
- [x] La eliminación borra las filas `post_child`, `post_photo` y los objetos de Storage asociados.
- [x] El enum persistido acepta `mood` y el feed muestra la etiqueta `Ánimo`.
- [x] La descripción no puede estar vacía después de aplicar `trim()`.
- [x] Una publicación no se envía sin sala y destinatarios válidos.
- [x] Se rechazan archivos que no sean JPG, PNG o WebP.
- [x] Se rechaza cualquier archivo mayor de 10 MB.
- [x] Se rechaza una selección de más de 10 imágenes.
- [x] Las validaciones de imágenes aparecen antes de iniciar la publicación.
- [x] Durante la publicación se deshabilitan acciones duplicadas y se muestra un estado de carga.
- [x] Si falla una imagen, no queda una publicación visible ni un objeto huérfano en Storage.
- [x] Si falla la creación de relaciones, se eliminan la publicación y los objetos ya subidos.
- [x] Si falla la edición, el formulario conserva los datos y la publicación anterior permanece intacta.
- [x] Si falla la eliminación, la publicación no desaparece silenciosamente y se muestra un error accionable.
- [x] El feed muestra las fotografías autorizadas con URLs no permanentes.
- [x] Cerrar el modal después de un error conserva el comportamiento de reset definido en SPEC 06.
- [x] `npx tsc --noEmit` termina sin errores.
- [x] `npx eslint app/` termina sin errores.
- [x] Las pruebas SQL verifican aislamiento entre daycares, roles, autores, padres y publicaciones.
- [x] La comparación visual conserva la composición de `references/pantallas/feed.dc.html` y `crear-publicacion.dc.html`.

## Decisions

- **Sí:** reutilizar el modal de SPEC 06 desde dos entradas. Evita duplicar validación y lógica de persistencia.
- **No:** crear una ruta separada para publicar. El flujo pertenece al feed.
- **Sí:** mostrar el compositor solo a staff y admin. Son los roles autorizados para publicar.
- **No:** permitir publicaciones de parent. No forman parte del alcance de esta feature.
- **Sí:** seleccionar salas y niños, no padres directamente. `post_child` y `parent_child` ya modelan la entrega a familiares.
- **No:** agregar destinatarios padre explícitos. Duplicaría la relación existente y complicaría el aislamiento.
- **Sí:** publicar `Toda la sala` como `announcement`. Es el modelo que ya utiliza el feed de padres.
- **No:** crear `post_child` para todos los niños en un anuncio de sala. El conjunto debe seguir siendo dinámico.
- **Sí:** agregar `mood` al enum. El usuario confirmó que `Ánimo` debe persistir como tipo propio.
- **No:** mapear `Ánimo` a `activity`. Perdería significado al consultar o editar.
- **Sí:** usar Storage privado y `post_photo`. Las imágenes pueden contener información sensible de niños.
- **No:** usar URLs públicas o base64 persistido. No ofrecen control de acceso ni son adecuadas para archivos grandes.
- **Sí:** aplicar límites de 10 imágenes y 10 MB por imagen. Mantiene controlados el tiempo de carga y el almacenamiento.
- **Sí:** operación atómica con limpieza compensatoria. Storage y Postgres no comparten una transacción nativa.
- **No:** crear publicaciones parciales. Una publicación sin todos sus adjuntos no cumple la intención del usuario.
- **Sí:** staff y admin consultan todo el daycare. Permite supervisión y conserva el modelo actual de lectura.
- **No:** permitir editar o eliminar publicaciones ajenas. La modificación queda limitada al autor.
- **Sí:** editar todos los campos, incluida la audiencia. El usuario lo confirmó explícitamente.
- **Sí:** confirmar la eliminación con un diálogo. Evita borrar por accidente una publicación con fotografías.
- **No:** implementar notificaciones. El feed es el único canal confirmado.
- **Sí:** conservar el formulario cuando falle una operación. Permite corregir o reintentar sin perder información.
- **No:** publicar en salas sin familias vinculadas. Evita crear contenido que ningún destinatario pueda recibir.

## Risks

| Riesgo                                                        | Mitigación                                                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Se sube una imagen y falla la creación del post               | Usar limpieza compensatoria y verificar que no queden objetos huérfanos.                         |
| Se crea el post y falla una relación `post_child`             | Eliminar el post y sus fotos antes de devolver el error.                                         |
| Un padre obtiene una URL de una foto no autorizada            | Mantener el bucket privado y generar URLs únicamente después de validar la visibilidad del post. |
| Un usuario manipula `room_id` o `child_id` desde el navegador | Validar sala, niños, daycare y rol en la operación del servidor.                                 |
| Un niño cambia de sala mientras se edita una publicación      | Revalidar pertenencia en cada creación o actualización y rechazar relaciones obsoletas.          |
| El enum `mood` rompe el mapeo existente del feed              | Actualizar simultáneamente `app/lib/data.ts`, `app/feed/data.ts` y las tarjetas.                 |
| Ediciones concurrentes pisan cambios de otro dispositivo      | Usar `updated_at` y rechazar una edición cuyo valor base ya no coincide.                         |
| Archivos grandes degradan la experiencia                      | Validar tamaño antes de subir y mostrar progreso o estado de carga.                              |
| El compositor cambia la composición visual del feed           | Reutilizar el patrón del mockup y verificar la posición, espaciado y estados con Playwright.     |

## What is **not** in this spec

- Borradores o publicaciones programadas.
- Notificaciones.
- Publicación por parte de familiares.
- Destinatarios padre seleccionados directamente.
- Títulos de publicación.
- Comentarios, likes o reacciones.
- Moderación.
- Bucket público.
- Edición o eliminación de publicaciones ajenas.
- Publicación en salas sin familias vinculadas.
- Maquetación mobile dedicada.

Cada uno de esos temas, si se requiere, debe definirse en una spec propia.
