# GLORIETA · Beta V1

Inventario de prueba con estética PARQUE: marco de madera, pizarrón oscuro, tiza, papeles y stickers. Diseño adaptable a celular y computadora.

## Estado
La interfaz ya está en GitHub. **Esta versión guarda productos, fotos y movimientos exclusivamente en el navegador local** (localStorage). No hay sincronización entre empleados ni dispositivo: NO usar como inventario real compartido todavía.

## Funciones
- Buscar por nombre, código, ubicación y color.
- Agregar artículos con fotografía comprimida y ficha de producto.
- Editar productos, registrar entradas y salidas, ver movimientos.
- Exportar/importar respaldo JSON.
- Cinco artículos ficticios precargados únicamente para pruebas.

## Publicación
Para habilitar la web: Settings → Pages → Build and deployment → Deploy from a branch → main → /(root) → Save.

Enlace esperado al activarse Pages: https://gafferman77.github.io/glorieta-app/

## Próxima etapa
Implementar almacenamiento central y fotos con backend protegido, probar simultaneidad, respaldos y recién entonces utilizarlo en operación con empleados. GitHub Pages solo ofrece alojamiento estático y **no** sustituye una base de datos compartida.

## Seguridad
La beta no pide login. Eso no autoriza exponer claves secretas de Supabase ni permitir escritura pública ilimitada.

## Backend compartido (preparado, todavía NO desplegado)
- `supabase/glorieta_schema.sql`: tablas, RLS, fotos privadas y funciones atómicas.
- `supabase/functions/glorieta-api/index.ts`: API con acceso mediante secreto `GLORIETA_ACCESS_CODE` configurado exclusivamente en Supabase.
- No hay contraseñas ni service-role keys en el repositorio público.
- Todavía falta autorizar organización de destino, crear proyecto independiente, aplicar SQL, configurar secreto, desplegar la función, conectar interfaz y probar entre dos dispositivos.
- Mientras eso no suceda, los datos del navegador son exclusivamente locales. **No cargar inventario real todavía**.


## Conexión compartida — 16 noviembre 2026
- Backend Edge Function `glorieta-api` desplegado en proyecto `czvchpltqyjqyopiiinl`.
- `index.html` sirve `cloud.js` en lugar de la antigua demo `app.js`.
- `cloud.js` requiere nombre del encargado y código de acceso compartido, guardados solo en sessionStorage.
- Fotos en bucket privado `glorieta-photos`, con enlaces temporales.
- Inventario nuevo comienza **vacío**; los cinco artículos de ejemplo ya no se muestran en la edición compartida.
- **Pendiente:** prueba real con dos celulares y verificación de operaciones de lectura, escritura y fotos. No confundir desplegado con validado.
- Para cambiar el código de acceso, sustituir el digest de la Edge Function y desplegar una nueva versión; no guardar el código en el repositorio público.
