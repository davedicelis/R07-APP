# R07 APP — Pasos para poner en producción

## 1. Crear proyecto en Supabase

1. Ir a [supabase.com](https://supabase.com) → **Start your project** (cuenta gratuita)
2. **New Project** → elige nombre, contraseña y región (US East o EU West)
3. Esperar ~2 minutos a que el proyecto levante
4. Ir a **Project Settings → API** y copiar:
   - `Project URL` → algo como `https://abcdefgh.supabase.co`
   - `anon public` key → token largo que empieza con `eyJ...`

---

## 2. Ejecutar el schema de la base de datos

1. En Supabase → **SQL Editor** → **New Query**
2. Pegar el contenido completo del archivo `supabase/schema.sql`
3. Clic en **Run** (▶)
4. Verificar que no haya errores y que aparezcan las tablas `profiles` y `r07_data` en **Table Editor**

---

## 3. Configurar Google OAuth

### 3a. Google Cloud Console
1. Ir a [console.cloud.google.com](https://console.cloud.google.com)
2. Crear un proyecto nuevo (o usar uno existente)
3. **APIs & Services → OAuth consent screen**
   - User type: **External**
   - Llenar nombre de la app (`R07 APP`), email de soporte
   - En **Scopes**: agregar `email` y `profile`
   - Guardar
4. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Nombre: `R07 APP`
   - **Authorized redirect URIs** → agregar:
     ```
     https://TU_PROYECTO.supabase.co/auth/v1/callback
     ```
     _(reemplaza `TU_PROYECTO` con el ID real de tu proyecto Supabase)_
5. Copiar el **Client ID** y el **Client Secret**

### 3b. Supabase — activar proveedor Google
1. En Supabase → **Authentication → Providers → Google**
2. Activar el toggle **Enable**
3. Pegar el **Client ID** y **Client Secret** del paso anterior
4. Guardar

---

## 4. Configurar URL de redirección en Supabase

1. Supabase → **Authentication → URL Configuration**
2. **Site URL**: `https://tu-dominio.com`
3. **Redirect URLs** → agregar: `https://tu-dominio.com`
4. Guardar

---

## 5. Actualizar las claves en app.js

Abrir `app.js` y reemplazar las líneas 6–7 con los valores reales:

```js
const SUPABASE_URL = 'https://TU_PROYECTO.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...TU_ANON_KEY';
```

> Las claves `anon` son públicas — no son secretos, pueden ir en el código.

---

## 6. Subir archivos a Hostinger

### Opción A — File Manager (más fácil)
1. Hostinger → **hPanel → File Manager**
2. Navegar a `public_html/`
3. Subir los archivos:
   - `index.html`
   - `app.js`
   - `style.css`
4. Abrir `https://tu-dominio.com` en el navegador

### Opción B — FTP (FileZilla)
1. Hostinger → **hPanel → FTP Accounts** → crear cuenta FTP
2. Conectar FileZilla con host/usuario/contraseña
3. Arrastrar los 3 archivos a `public_html/`

---

## 7. Probar que todo funciona

- [ ] Abrir `https://tu-dominio.com` → debe mostrar la pantalla de bienvenida R07 APP
- [ ] Clic en **Ingresar con Google** → redirige a Google, se autoriza, vuelve al app
- [ ] Llenar datos de un día → guardar → ir a Supabase → **Table Editor → r07_data** → verificar que aparece el registro
- [ ] Abrir la misma URL en otro dispositivo con el mismo Google → los datos deben estar ahí
- [ ] Botón **Compartir** → genera PDF y abre selector de apps (en celular)
- [ ] Botón **Cerrar sesión** (ícono en el header) → vuelve a la pantalla de login

---

## Diagrama de arquitectura

```
Usuario (celular/PC)
       │
       ▼
Hostinger — tu-dominio.com
  index.html + app.js + style.css  (archivos estáticos)
       │
       │  supabase-js (CDN)
       ▼
Supabase (gratuito)
  ├── Auth: Google OAuth
  ├── DB: tabla profiles   (nombre, avatar, email)
  └── DB: tabla r07_data   (datos R07 por día, por usuario)
```
