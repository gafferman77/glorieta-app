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