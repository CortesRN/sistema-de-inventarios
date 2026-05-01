## Operacion del Sistema CASI

### Objetivo

Tener una sola app web con reglas claras para:

- controlar inventario
- vender en tienda online
- gestionar pedidos
- asignar rutas a repartidores
- preparar el terreno para vendedores externos

La meta es evitar duplicados, sobreventa, errores de captura y accesos inseguros.

---

## 1. Estructura general

La app debe vivir como un solo sistema con 4 modos:

1. `Store`
   Solo para clientes.

2. `Admin`
   Control total de tickets, inventario, pedidos, rutas y configuracion.

3. `Driver`
   Solo para ver rutas y actualizar entregas asignadas.

4. `Vendor`
   Modulo futuro, con acceso limitado a sus propios productos y pedidos.

---

## 2. Inventario como fuente maestra

El inventario es la verdad principal del negocio.

Cada pieza debe tener al menos:

- `clave` o `SKU`
- `idInterno`
- `ticketOrigen`
- `nombre`
- `descripcion`
- `categoria`
- `genero`
- `marca`
- `talla`
- `costoUSD`
- `costoMXN`
- `precio`
- `ubicacion`
- `estado`
- `activo`
- `foto` o `fotos`

### Reglas clave

1. Un `SKU` nunca se reutiliza.
2. Un producto vendido no debe regresar a inventario activo sin accion administrativa.
3. Un ticket ya convertido a inventario no debe volver a generar piezas nuevas, salvo flujo controlado.
4. Los productos publicos en tienda deben salir solo de inventario `activo == true`.

---

## 3. Flujo real de ticket a inventario

### Ticket

El ticket representa la compra de origen.

Estados recomendados:

1. `draft`
   Aun en captura.

2. `costed`
   Ya tiene costeo provisional.

3. `complete`
   Ticket completo y listo para generar o actualizar inventario.

### Regla de operacion

1. Crear ticket.
2. Capturar fecha real de compra.
3. Capturar lineas, cantidades, costos, impuestos y otros gastos.
4. Validar que el total del ticket cuadre.
5. Generar inventario una sola vez.
6. Si ya existe inventario ligado a ese ticket:
   - actualizar costos, nunca duplicar piezas
   - bloquear si la cantidad ya no coincide

### Casos especiales

- `Modo individual`
  Prorrateo con peso mayor al producto mas caro y menor al mas barato.

- `Modo lote`
  Costo provisional por pieza sobre el total del lote.

- `Ticket historico`
  Si ya venia detallado por pieza desde sistema viejo, no regenerar desde ticket.

---

## 4. Estados de inventario

Estados operativos recomendados:

1. `en_bodega`
   La pieza existe pero aun no esta publicada para venta.

2. `en_venta`
   Visible para clientes y disponible.

3. `reservado`
   Apartada temporalmente por un pedido confirmado.

4. `vendido`
   Ya salio definitivamente.

### Regla importante

Un producto no debe seguir visible en tienda si esta:

- `reservado`
- `vendido`
- `activo == false`

---

## 5. Flujo de pedidos

### Objetivo

Separar claramente lo publico de lo privado.

### Lo publico

El cliente puede:

- ver productos activos
- crear su pedido
- consultar despues por un canal seguro

El cliente no debe:

- leer pedidos de otros
- listar toda la coleccion `orders`
- ver datos internos de costo o logistica

### Estados recomendados del pedido

1. `nuevo`
   Pedido recien creado.

2. `verificando`
   Validando pago o datos.

3. `confirmado`
   Pedido aceptado; aqui ya se debe reservar inventario.

4. `preparando`
   Armado del pedido.

5. `en_ruta`
   Ya asignado a repartidor o salida.

6. `entregado`
   Pedido finalizado; aqui el inventario debe quedar como vendido.

7. `cancelado`
   Se cancelo; si habia reserva, debe liberarse.

### Reglas operativas

1. Crear pedido no debe vender automaticamente.
2. Confirmar pedido debe reservar inventario.
3. Entregar pedido debe cerrar venta.
4. Cancelar pedido debe liberar inventario si no fue entregado.

---

## 6. Reserva de inventario

Este punto es importante para evitar sobreventa.

### Recomendacion

Cuando un pedido pase a `confirmado`:

- los productos del pedido cambian a `reservado`
- `activo` debe pasar a `false`

Cuando el pedido pase a `entregado`:

- los productos cambian a `vendido`

Cuando el pedido pase a `cancelado`:

- los productos regresan a `en_venta`
- `activo` vuelve a `true`

---

## 7. Rutas y repartidores

No hace falta comenzar con logistica compleja.

### Modelo recomendado

Crear una entidad `ruta` o `salida` con:

- `rutaId`
- `fecha`
- `driverId`
- `zona`
- `pedidos`
- `estado`

### Estados de ruta

1. `borrador`
   Aun se esta armando.

2. `asignada`
   Ya tiene repartidor.

3. `en_curso`
   Repartidor ya salio.

4. `cerrada`
   Ruta terminada.

### Flujo simple

1. Admin revisa pedidos `confirmado` o `preparando`.
2. Agrupa por zona o dia.
3. Crea ruta.
4. Asigna repartidor.
5. Repartidor ve solo sus pedidos.
6. Repartidor marca entregado o incidencia.
7. Admin revisa y cierra ruta.

---

## 8. Repartidores

El modo `Driver` solo debe poder:

- ver pedidos asignados
- marcar salida
- marcar entregado
- reportar fallo o incidencia

No debe poder:

- editar inventario completo
- ver tickets
- ver costos internos
- ver pedidos ajenos

---

## 9. Vendedores externos

Esto va despues.

### Condicion para activarlo

Primero deben estar estables:

- tickets
- inventario
- pedidos
- rutas
- auth y permisos

### Cuando se active

El vendedor solo debe poder:

- ver sus productos
- ver sus pedidos
- ver sus ventas
- editar informacion limitada

No debe poder:

- ver inventario global
- ver costos de otros
- modificar tickets o contadores

---

## 10. Roles y permisos

### Publico

- leer solo productos activos
- crear pedidos

### Admin

- leer y editar todo

### Driver

- ver y actualizar solo sus rutas y pedidos asignados

### Vendor

- ver solo su informacion propia

---

## 11. Reglas de seguridad recomendadas

### Nunca confiar solo en la interfaz

Ocultar botones no es seguridad.

La seguridad real debe vivir en:

- `Firebase Auth`
- `Firestore Rules`

### Direccion recomendada

1. Publico:
   - `inventario`: lectura limitada a activos
   - `orders`: solo crear

2. Admin autenticado:
   - lectura y escritura total

3. Driver autenticado:
   - acceso limitado a sus rutas

4. Vendor autenticado:
   - acceso limitado a sus recursos

---

## 12. Controles anti error

### En tickets

- no duplicar inventario por re-edicion
- bloquear si cantidad ya no coincide
- respetar fecha de compra
- respetar ticket origen

### En inventario

- no reutilizar SKU
- no vender productos no activos
- no dejar activo un producto vendido

### En pedidos

- no permitir confirmar sin inventario disponible
- no permitir entregar pedido cancelado
- no permitir ver pedidos de otros usuarios

### En rutas

- no asignar el mismo pedido a dos rutas
- no marcar entregado si el pedido no esta en ruta

---

## 13. Orden recomendado de implementacion

1. Cerrar `Firebase Auth` para admin.
2. Definir `Firestore Rules`.
3. Asegurar bien reserva/liberacion de inventario por pedido.
4. Crear flujo formal de rutas.
5. Crear acceso limitado para repartidor.
6. Crear seguimiento seguro de pedido para cliente.
7. Activar vendedores externos.

---

## 14. Documentacion pendiente del proyecto

Despues conviene dejar por escrito:

1. Arquitectura general.
2. Modelo de datos por coleccion.
3. Flujo de tickets.
4. Flujo de inventario.
5. Flujo de pedidos.
6. Flujo de rutas.
7. Reglas de seguridad.
8. Procedimiento de migracion y respaldos.

Ese documento si vale la pena hacerlo, porque ya te serviria como manual real de operacion y mantenimiento.
