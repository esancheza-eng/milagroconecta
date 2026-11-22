# Milagro Conecta 📱

Directorio de negocios, bolsa de empleo y perfiles tipo LinkedIn de Milagro.
HTML + JS + Firebase (Auth + Firestore). Sin servidor propio. Se publica en GitHub Pages.

## Planes
| | Gratis | Pro | Premium |
|---|---|---|---|
| Ficha (foto, GPS, teléfono, horario) | ✔ | ✔ | ✔ |
| Botón WhatsApp, redes, sello | – | ✔ | ✔ |
| Galería | – | 3 fotos | 5 fotos |
| Ofertas de empleo | 1 | 3 | ilimitadas |
| Aparece primero + ⭐ Destacados | – | – | ✔ |
| Estadísticas (vistas, llamadas, WhatsApp) | vistas | vistas | ✔ completas |

Perfiles de candidatos: Gratis o Premium (aparece primero, sello ★ Destacado).
Los precios se cambian en la app: **Admin → Ajustes**.

## Puesta en línea (≈ 15 min)

### 1. Firebase
1. https://console.firebase.google.com → **Agregar proyecto** (ej. `milagro-conecta`). Desactiva Analytics si quieres.
2. **Compilación → Authentication → Comenzar** y habilita **Correo/contraseña** y **Google**.
3. **Compilación → Firestore Database → Crear base de datos** (modo producción, región `us-east1` o la más cercana).
4. Pestaña **Reglas** → pega TODO el contenido de `firestore.rules` → **Publicar**.
5. **Configuración del proyecto (⚙️) → Tus apps → Web `</>`** → registra la app y copia el `firebaseConfig`.
6. Pega esos datos en `firebase-config.js`.
7. **Authentication → Configuración → Dominios autorizados** → agrega `milagroconecta.elhyai.com` y `esancheza-eng.github.io`.

> No necesitas Firebase Storage (las imágenes se comprimen y se guardan en Firestore), así que funciona con el plan gratuito Spark.

### 2. Tu usuario administrador
1. Abre la app, **crea tu cuenta** con tu correo.
2. Firebase Console → Authentication → Usuarios → copia tu **UID**.
3. Firestore → **Iniciar colección** `admins` → ID del documento = tu **UID** → agrega un campo `activo` = `true`.
4. Recarga la app: arriba verás **⚙️ Admin**.
5. En **Admin → Ajustes** pon tu WhatsApp, datos de pago y precios.

### 3. GitHub Pages
1. Crea un repositorio (ej. `milagroconecta`) y sube todos los archivos de esta carpeta.
2. Settings → Pages → Branch `main` / root.
3. (Opcional) Dominio propio: en Namecheap crea un registro **CNAME** `milagroconecta` → `esancheza-eng.github.io`. El archivo `CNAME` ya está incluido (bórralo si no usarás dominio propio). Si usas otro dominio, cambia también `og:image` en `index.html` y `dominio` en `firebase-config.js`.

## Cómo funciona la aprobación
- Todo lo que suben los usuarios (negocios, perfiles, ofertas) queda **pendiente** hasta que tú lo apruebas en **Admin → Pendientes**.
- Si un usuario edita algo ya aprobado, vuelve a revisión.
- Pagos: el usuario sube su comprobante → tú lo ves en **Admin → Pagos** → **Activar plan** (suma los meses pagados).
- Los planes vencidos vuelven solos a Gratis.

## Archivos
`index.html` · `styles.css` · `app.js` · `firebase-config.js` · `firestore.rules` · `manifest.json` · `sw.js` · `logo.jpg` · `og.jpg` · `icon-*.png` · `CNAME`
