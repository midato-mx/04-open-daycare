# SPEC 12 — Perfil del usuario autenticado en el sidebar

> **Status:** Implemented
> **Depends on:** SPEC 09, SPEC 10
> **Date:** 2026-11-19
> **Objective:** Mostrar en el sidebar el nombre y el rol reales del usuario autenticado en todas las rutas privadas, eliminando las leyendas estáticas de sala.

## Scope

**In:**

- Obtener el perfil autenticado desde `public.user` usando la sesión SSR existente.
- Mostrar `full_name` en el bloque inferior del sidebar.
- Mostrar una etiqueta de rol en español:
  - `staff` → `Maestra`.
  - `parent` → `Familiar`.
  - `admin` → `Administradora`.
- Generar la inicial del avatar a partir del nombre real.
- Compartir la carga del perfil mediante un layout privado de App Router.
- Aplicar el comportamiento a `/`, `/kids` y `/kids/[id]`.
- Mostrar `Usuario` y `Rol no disponible` como fallback cuando la sesión exista pero el perfil no pueda cargarse.
- Eliminar `Sala Soles` de la parte superior del sidebar.
- Eliminar `· Soles` de la línea inferior del usuario.
- Conservar el diseño, dimensiones, colores y botón de logout actuales.

**Out of scope (para specs futuros):**

- Crear una relación `user` → `room`.
- Agregar `room_id` a `public.user`.
- Asignar salas a usuarios desde la interfaz.
- Mostrar una sala dinámica en el sidebar.
- Crear o modificar tablas, enums, RLS, triggers o migraciones.
- Implementar la pantalla funcional de «Mi cuenta».
- Cambiar las reglas de autorización por rol.
- Cambiar el nombre o rol del usuario desde la interfaz.
- Maquetación mobile dedicada.

## Data model

Esta feature no introduce estructuras nuevas en la base de datos. Reutiliza el perfil existente de `public.user` y la sesión autenticada de Supabase.

```ts
type UserRole = "staff" | "parent" | "admin";

type AuthenticatedUserProfile = {
  full_name: string;
  role: UserRole;
};

const roleLabels: Record<UserRole, string> = {
  staff: "Maestra",
  parent: "Familiar",
  admin: "Administradora",
};
```

El perfil no contiene ni obtiene una sala. La sala solo está asociada a los niños y no forma parte de esta feature.

## Implementation plan

1. Crear una función server reutilizable para consultar `full_name` y `role` del usuario autenticado con el cliente SSR existente, conservando un resultado fallback cuando no haya perfil.
2. Crear el layout privado compartido para las rutas autenticadas actuales y mover dentro de él la composición común del sidebar sin cambiar las URLs públicas.
3. Actualizar `Sidebar` para recibir el perfil autenticado, traducir el rol, calcular la inicial y eliminar las dos leyendas de sala.
4. Integrar el layout con `/`, `/kids` y `/kids/[id]`, preservando el estado activo de la navegación y el contenido específico de cada página.
5. Retirar el uso visual del usuario ficticio `currentUser` en el sidebar y conservar únicamente los datos estáticos que todavía tengan consumidores legítimos.
6. Verificar el flujo autenticado, el fallback de perfil, la persistencia visual tras recargar y la ausencia de consultas o referencias a una sala de usuario.

## Acceptance criteria

- [x] Una sesión autenticada con perfil `full_name = "Caro Giménez"` muestra `Caro Giménez` en el footer del sidebar.
- [x] El avatar del sidebar muestra la inicial del nombre autenticado.
- [x] Un perfil con rol `staff` muestra `Maestra`.
- [x] Un perfil con rol `parent` muestra `Familiar`.
- [x] Un perfil con rol `admin` muestra `Administradora`.
- [x] El sidebar no muestra `Sala Soles` en la parte superior.
- [x] El sidebar no muestra `· Soles` junto al rol del usuario.
- [x] El perfil mostrado es el de la sesión actual y no el valor fijo `currentUser`.
- [x] `/`, `/kids` y `/kids/[id]` reutilizan el layout privado compartido.
- [x] La navegación mantiene el elemento activo correcto en cada una de esas rutas.
- [x] Cuando la sesión existe pero no se encuentra el perfil, el sidebar muestra `Usuario` y `Rol no disponible`.
- [x] La ausencia del perfil no provoca un error de renderizado del sidebar.
- [x] El botón de logout conserva su comportamiento real y su apariencia.
- [x] No se crea ni modifica ninguna tabla, migración, relación o política de Supabase.
- [x] No se consulta ni se agrega `user.room_id`.
- [x] `npx tsc --noEmit` termina sin errores.
- [x] `npx eslint app/` termina sin errores.
- [x] La revisión visual confirma que el bloque inferior conserva el estilo de la referencia, salvo el contenido dinámico y la eliminación de la sala.

## Decisions

- **Sí:** reutilizar `public.user.full_name` y `public.user.role`. Es la fuente de verdad del perfil autenticado.
- **No:** conservar `currentUser.name` y `currentUser.role` para renderizar el sidebar. Son datos ficticios del mockup.
- **Sí:** usar un layout privado compartido. Evita repetir la consulta y garantiza consistencia entre rutas.
- **No:** duplicar la consulta del perfil en cada página. Aumenta el acoplamiento y puede producir valores inconsistentes.
- **Sí:** traducir `staff`, `parent` y `admin` en la UI. Los valores técnicos permanecen en inglés en la base de datos.
- **No:** mostrar los valores técnicos de rol directamente. No coinciden con el lenguaje de la interfaz.
- **Sí:** eliminar por completo la sala del sidebar. El esquema solo asocia salas con niños.
- **No:** agregar `user.room_id` ni inferir una sala a partir de los niños. No existe una asignación válida para todos los usuarios.
- **Sí:** mostrar un fallback neutro cuando falte el perfil. La sesión puede existir aunque el registro de dominio no esté disponible.
- **No:** interrumpir toda la página por un perfil faltante. El resto de la navegación debe conservar un estado degradado utilizable.
- **Sí:** preservar el logout y la navegación actuales. La feature cambia los datos del usuario, no las acciones existentes.

## Risks

| Risk                                                     | Mitigation                                                                                           |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| El layout compartido altera el estado activo del sidebar | Verificar `/`, `/kids` y `/kids/[id]` individualmente y conservar la selección actual por ruta.      |
| Un usuario autenticado no tiene fila en `public.user`    | Usar el fallback `Usuario` / `Rol no disponible` y no asumir que la consulta siempre devuelve datos. |
| La extracción del sidebar rompe el layout existente      | Comparar visualmente el header, contenido principal, footer y botón de logout antes y después.       |
| La migración de rutas cambia accidentalmente una URL     | Usar un route group sin segmento visible y comprobar que las tres URLs públicas permanezcan iguales. |

## What is **not** in this spec

- Asignación de salas a usuarios.
- Campo `room_id` en `public.user`.
- Sala dinámica en la marca o en el footer del sidebar.
- Administración de perfiles.
- Cambios de roles o permisos.
- Migraciones o cambios de esquema.
- Pantalla funcional de «Mi cuenta».
- Maquetación mobile dedicada.
