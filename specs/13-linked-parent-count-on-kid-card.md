# SPEC 13 — Conteo de padres vinculados en la tarjeta del niño

> **Status:** Implemented
> **Depends on:** SPEC 10, SPEC 11
> **Date:** 2026-11-19
> **Objective:** Mostrar en cada tarjeta de `/kids` el número de vínculos `parent_child` aceptados del niño.

## Scope

**In:**

- Mostrar el conteo de padres vinculados en las tarjetas de la sección `Niños`.
- Contar únicamente las relaciones aceptadas y persistidas en `public.parent_child`.
- Mostrar `sin padres vinculados` cuando el conteo sea cero.
- Mostrar `1 padre vinculado` cuando exista un solo vínculo.
- Mostrar `{n} padres vinculados` cuando existan dos o más vínculos.
- Mantener el botón `VINCULAR` cuando el niño no tenga padres vinculados.
- Mantener el diseño, los colores, la tipografía y la distribución actuales de la tarjeta.
- Conservar los estados de invitación pendientes para el perfil del niño, sin contarlos como vínculos aceptados en la tarjeta.

**Out of scope (para specs futuros):**

- Cambiar el flujo de invitaciones o aceptación de padres.
- Crear, editar, desvincular o eliminar relaciones `parent_child`.
- Mostrar el conteo en `/kids/[id]`.
- Implementar búsqueda o filtros en `/kids`.
- Crear nuevas tablas, columnas, migraciones, triggers o políticas de Supabase.
- Cambiar los permisos o el aislamiento por daycare.
- Maquetación mobile dedicada.

## Data model

Esta feature no introduce estructuras nuevas. Reutiliza `Kid.linkedParents` y la relación persistida `public.parent_child` definida en SPEC 11.

La tarjeta debe derivar su conteo únicamente de padres con estado `active`:

```ts
const linkedParentCount = kid.linkedParents.filter(
  (parent) => parent.status === "active",
).length;
```

Las invitaciones con estado `pending` pueden seguir disponibles para otras superficies, pero no incrementan `linkedParentCount`.

## Implementation plan

1. Actualizar `app/components/KidCard.tsx` para derivar el conteo a partir de los padres con estado `active`, conservando el fallback textual para cero.
2. Mantener la consulta de `/kids` compatible con los vínculos aceptados y las invitaciones pendientes que ya consume el perfil, sin incluir invitaciones pendientes en el conteo visual de la tarjeta.
3. Verificar visualmente las tarjetas con cero, un vínculo aceptado, varios vínculos aceptados y una combinación de vínculo aceptado con invitación pendiente.
4. Ejecutar `npx tsc --noEmit` y `npx eslint app/`, y comprobar que `/kids` conserva el botón `VINCULAR`, la navegación y el diseño existente.

## Acceptance criteria

- [x] Una tarjeta sin relaciones `parent_child` aceptadas muestra `sin padres vinculados`.
- [x] Una tarjeta con exactamente un vínculo `parent_child` aceptado muestra `1 padre vinculado`.
- [x] Una tarjeta con dos o más vínculos `parent_child` aceptados muestra el número correcto seguido de `padres vinculados`.
- [x] Una invitación `pending` no incrementa el número mostrado en la tarjeta.
- [x] Una invitación `expired`, `cancelled` o `accepted` que no tenga un vínculo aceptado no incrementa el número por sí misma.
- [x] El conteo se calcula usando los datos del niño mostrado y no un número estático o global.
- [x] Cuando no se pueden cargar relaciones, la tarjeta no expone un error técnico y muestra `sin padres vinculados`.
- [x] El botón `VINCULAR` continúa visible para un niño sin padres vinculados.
- [x] La tarjeta conserva su enlace a `/kids/[id]`.
- [x] `/kids/[id]` no cambia como parte de esta spec.
- [x] No se crean ni modifican tablas, migraciones, relaciones, RLS o privilegios de Supabase.
- [x] `npx tsc --noEmit` termina sin errores.
- [x] `npx eslint app/` termina sin errores.
- [x] La revisión visual confirma que únicamente cambia el texto del resumen de padres.

## Decisions

- **Sí:** contar únicamente relaciones `parent_child` aceptadas. Es el significado de “padres vinculados”.
- **No:** contar invitaciones `pending`. Una invitación enviada todavía no representa una cuenta vinculada.
- **Sí:** reutilizar `Kid.linkedParents` y su estado `active`/`pending`. Evita una consulta o estructura paralela para una presentación derivada.
- **No:** agregar un contador persistido en `child`. El valor se puede calcular desde la relación existente y podría quedar desactualizado.
- **Sí:** mostrar `sin padres vinculados` cuando el valor sea cero o la consulta de relaciones falle. La lista debe conservarse utilizable.
- **No:** mostrar `No disponible` ni bloquear todas las tarjetas por un fallo de relaciones. No aporta una acción útil en esta vista.
- **Sí:** limitar el cambio a las tarjetas de `/kids`. El perfil del niño conserva su información detallada y sus estados pendientes.
- **No:** modificar invitaciones, vínculos o permisos. Esas operaciones pertenecen a SPEC 11 y a futuras specs de administración.

## Risks

| Riesgo                                                       | Mitigación                                                                                                                                 |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Una invitación pendiente se interpreta como vínculo aceptado | Filtrar explícitamente por `status === "active"` antes de construir la etiqueta.                                                           |
| Un fallo de consulta hace que el conteo parezca cero         | Mantener el fallback neutro y no exponer detalles técnicos; la carga de relaciones ya es opcional para la tarjeta.                         |
| La tarjeta y el perfil muestran cantidades distintas         | Mantener el cambio únicamente en la presentación de la tarjeta y verificar por separado la combinación de vínculos aceptados y pendientes. |

## What is **not** in this spec

- Cambios al esquema o a las políticas de Supabase.
- Crear o aceptar invitaciones.
- Desvincular padres.
- Conteo visible en `/kids/[id]`.
- Búsqueda, filtros o nueva maquetación responsive.
