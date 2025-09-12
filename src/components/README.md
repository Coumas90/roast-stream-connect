# Componentes

Este directorio agrupa los componentes de la aplicación organizados por dominio o finalidad.

## Estructura

- **app/**: Elementos de la interfaz principal para los usuarios finales (por ejemplo, modales, vistas de equipo, etc.).
- **admin/**: Componentes utilizados en herramientas administrativas y paneles de control.
- **auth/**: Componentes relacionados con autenticación y manejo de sesiones.
- **layout/**: Bloques de diseño reutilizables que componen la estructura de las páginas.
- **ui/**: Primitivas de interfaz reutilizables basadas en [shadcn/ui](https://ui.shadcn.com) y Tailwind CSS.

## Pautas de estilo

- Escribe los componentes en **TypeScript** utilizando funciones de React (componentes funcionales).
- Nombra los archivos de componentes en **PascalCase** (`MiComponente.tsx`).
- Aplica estilos con **Tailwind CSS** y combina clases con la utilidad `cn` de `@/lib/utils`.
- Mantén cada componente en su propio archivo junto a los recursos que necesite (hooks, estilos, etc.).

## Ejemplos y Storybook

Actualmente el proyecto no incluye Storybook. Los ejemplos de uso pueden consultarse directamente en los archivos de cada submódulo.

## Actualizaciones

Si se añaden nuevos submódulos de componentes, actualiza este README para reflejar la nueva estructura.
