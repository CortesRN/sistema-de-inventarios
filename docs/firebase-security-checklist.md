## Firebase Security Checklist

### Lo mas importante

1. La seguridad real no esta en `config.js`.
2. La seguridad real esta en:
   - `Firestore Rules`
   - `Firebase Auth`
3. El acceso admin debe quedar protegido con usuarios reales de Firebase Auth.

### Lo que ya quedo mejor en la app

- La pantalla publica ya no carga todos los pedidos al abrir.
- La consulta publica de `Mis pedidos` quedo desactivada temporalmente.
- La tienda ahora pide solo inventario `activo == true`.
- La pantalla de `Migracion` ya no esta expuesta en produccion.
- El `ADMIN PIN` ya fue eliminado del flujo de acceso.
- Ya existe un esqueleto para login admin con `Firebase Auth`.

### Variables de entorno nuevas

Define estas variables en tu `.env.local` cuando quieras activar el acceso admin real:

```txt
VITE_ENABLE_ADMIN_AUTH=true
VITE_ADMIN_EMAILS=admin1@casi.com,admin2@casi.com,admin3@casi.com
```

### Que debes hacer en Firebase Console

#### 1. Authentication

- Entra a `Firebase Console > Authentication`.
- Habilita `Email/Password`.
- Crea los 3 usuarios admin que si deben entrar.
- Usa los mismos correos en `VITE_ADMIN_EMAILS`.

#### 2. Firestore Rules

- Entra a `Firebase Console > Firestore Database > Rules`.
- Si hoy tus reglas permiten lectura o escritura publica, tus datos siguen expuestos aunque la interfaz se vea mejor.

### Objetivo recomendado de reglas

#### Publico

- Leer solo productos activos de `inventario`.
- Crear pedidos en `orders`.

#### Privado

- Leer todos los pedidos.
- Editar pedidos.
- Leer tickets, envios, contadores, gastos, vendedores y repartidores.
- Crear o editar inventario.

### Meta funcional

```txt
inventario:
  publico: lectura de productos activos
  admin: lectura y escritura total

orders:
  publico: solo crear
  admin: lectura y escritura total

tickets/envios/contadores/gastos/vendors/drivers/config:
  solo admin autenticado
```

### Orden recomendado

1. Confirmar que la tienda publica sigue funcionando.
2. Activar `Email/Password` en Firebase Auth.
3. Crear los 3 usuarios admin.
4. Definir `VITE_ENABLE_ADMIN_AUTH=true`.
5. Definir `VITE_ADMIN_EMAILS`.
6. Probar login y logout admin.
7. Endurecer reglas de Firestore.
8. Reabrir solo las rutas estrictamente necesarias.

### Lo que no conviene hacer

- Confiar en ocultar botones como medida de seguridad.
- Dejar `orders` legible publicamente.
- Leer todo `inventario` y filtrar en cliente si luego quieres reglas publicas mas cerradas.
- Dejar el panel admin abierto en produccion sin `Firebase Auth`.
