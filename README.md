## Montecristo Catálogo – Next.js + Google Sheets

Catálogo visual de perfiles para agencia de casting, unificando 8 hojas de Google Sheets (Montevideo / Punta del Este × ACTORES / CASTING / EXTRAS / MENORES) en una sola interfaz con filtros potentes, modal de ficha completa y panel de administración simple.

### 1. Requisitos

- Cuenta Google con acceso de edición al Spreadsheet principal.
- Node.js 18+.
- Vercel (o entorno compatible con Next.js 14 App Router).

### 2. Estructura general

- `src/config/sheets.ts`: definición de las 8 sheets (location, category, key, sheetName, columnas exactas).
- `src/lib/normalize.ts`: pasa de objeto crudo (`raw`) a un perfil normalizado (`NormalizedProfile`) + `extraFields`.
- `src/app/page.tsx`: catálogo público con filtros, grid de cards y modal de ficha.
- `src/app/admin/page.tsx`: panel simple para editar campos clave y guardar en la misma row de la sheet original.
- `Code.gs`: código del Google Apps Script (Web App) que expone:
  - `GET`: devuelve JSON con todos los perfiles combinados.
  - `POST`: actualiza celdas en la row indicada por `rowRef`, validando una clave de admin.

### 3. Configuración de Google Sheets + Apps Script

**Estructura real**: Tenés 8 spreadsheets separados (uno por cada combinación location+category), cada uno con su propia pestaña de respuestas del formulario.

1. **Preparar los Spreadsheets**
   - Cada spreadsheet debe tener una pestaña con el nombre exacto de las respuestas del formulario:
     - `ACTORES (Respuestas)` o `ACTORES (respuestas)` (según cómo lo tengas)
     - `CASTING (Respuestas)` o `CASTING (respuestas)`
     - `EXTRAS (Respuestas)` o `EXTRAS (respuestas)`
     - `MENORES (Respuestas)` o `MENORES (respuestas)`
   - La primera fila de cada pestaña debe ser el header con las columnas **exactas** que detalla el enunciado. No renombrar, no reordenar.

2. **Crear el Apps Script**
   - Ir a https://script.google.com (o desde cualquier Google Sheet: **Extensiones → Apps Script**).
   - Crear un nuevo proyecto (o usar uno existente).
   - Borrar cualquier código existente y pegar el contenido de `Code.gs` tal cual.
   - Editar al principio de `Code.gs`:
     - `CONFIG.ADMIN_PASSWORD`: clave privada de administración (ej: `"mi-clave-super-secreta-2025"`).
     - En el array `SHEETS`, rellenar cada `spreadsheetId` con el ID real de cada archivo:
       - Para obtener el ID: abrir el spreadsheet en Drive, la URL es `https://docs.google.com/spreadsheets/d/ID_AQUI/edit`
       - El ID es lo que va entre `/d/` y `/edit`
     - Verificar que cada `sheetName` coincida exactamente con el nombre de la pestaña en ese spreadsheet.

3. **Publicar como Web App (DEPLOY)**
   - En el editor de Apps Script, arriba a la derecha: botón **"Deploy"** → **"New deployment"**.
   - Si no ves "Deploy", puede estar como ícono de engranaje ⚙️ → **"Deployments"** → **"New deployment"**.
   - Tipo de deployment: seleccionar **"Web app"**.
   - Configuración:
     - **Description**: `"Montecristo API"` (opcional).
     - **Execute as**: `"Me"` (tu usuario).
     - **Who has access**: `"Anyone"` (o `"Anyone with Google account"` si preferís más restricción).
   - Clic en **"Deploy"**.
   - Si es la primera vez, Google te pedirá autorización. Clic en **"Authorize access"** y seguí los pasos (permisos para leer/escribir en tus Sheets).
   - **Copiar la URL que te da**: algo como `https://script.google.com/macros/s/AKfycby.../exec`
   - **Esa URL es tu API**: la vas a usar en Next.js como `NEXT_PUBLIC_APPS_SCRIPT_URL`.

4. **Flujo de endpoints**
   - `GET https://script.google.com/.../exec`
     - Devuelve `{ profiles: [...] }`.
     - Cada elemento incluye:
       - `location`, `category`
       - `rowRef: { sheetKey, rowIndex }`
       - `raw: { "Nombre exacto columna": "valor", ... }`
   - `POST https://script.google.com/.../exec`
     - Headers:
       - `Content-Type: application/json`
     - Body JSON:
       - `{ "action": "update", "adminSecret": "tu-clave-admin", "rowRef": { "sheetKey": "...", "rowIndex": 12 }, "updates": { "NÚMERO DE CONTACTO": "..." } }`
     - El script valida `adminSecret` contra `CONFIG.ADMIN_PASSWORD`, busca la sheet por `sheetKey`, localiza las columnas por nombre **exacto** y escribe los nuevos valores en la fila `rowIndex`.

### 4. Variables de entorno (Next.js / Vercel)

Crear un archivo `.env.local` en desarrollo (y variables en Vercel en producción):

```bash
NEXT_PUBLIC_APPS_SCRIPT_URL="https://script.google.com/macros/s/XXX/exec"
```

- `NEXT_PUBLIC_APPS_SCRIPT_URL`: URL pública del Web App de Apps Script (la de `/exec`).
- La clave real de admin **no** se expone en variables públicas; se ingresa manualmente en `/admin` y se guarda en `localStorage`, luego se envía en el body del POST como `adminSecret`. El Apps Script la valida contra `CONFIG.ADMIN_PASSWORD`.

### 5. Catálogo público (`/`)

- **Carga de datos**:
  - `page.tsx` hace un `fetch(NEXT_PUBLIC_APPS_SCRIPT_URL)` y espera `{ profiles: [...] }`.
  - El Apps Script devuelve objetos con `raw`; en un flujo completo, si se prefiere, se puede pasar por `normalizeProfile(...)` en backend antes de enviarlos al cliente. En esta implementación el Script envía `raw` y el front espera ya `NormalizedProfile`; adapta fácilmente si querés que la normalización quede 100% en el front.
- **UI principal**:
  - Fondo claro, tipografía limpia, contenedor centrado.
  - Search bar de texto completo (nombre, ciudad, habilidades, idiomas).
  - Filtros globales:
    - Locación (`Montevideo` / `Punta del Este`).
    - Categoría (`ACTORES`, `CASTING`, `EXTRAS`, `MENORES`).
    - Género (valores únicos detectados del dataset).
  - Grid de cards:
    - Foto principal (cuando existe).
    - Nombre + chips de edad, altura, género, locación/categoría.
    - Hover con leve scale + shadow.
  - Paginación:
    - Se muestran perfiles aleatorios (shuffle) al cargar.
    - Botón "Cargar más" (paginación por bloques).
  - Modal accesible:
    - Se abre al hacer click en una card.
    - Cierra con `ESC`, click afuera o botón ✕.
    - Ficha organizada en secciones (Datos personales, Medidas, Apariencia, Skills, Experiencia, Logística, Salud, Contacto, Links, Otros campos).
    - Campos inexistentes se omiten silenciosamente.

### 6. Panel admin (`/admin`)

- **Login simple**:
  - Pantalla inicial pide una clave.
  - Al enviar, se guarda en `localStorage` y se considera "logueado".
  - No hay validación previa en el front; el Apps Script es quien decide si la clave es válida o no.

- **Listado de perfiles**:
  - Búsqueda por nombre, mail, teléfono.
  - Lista scrollable de perfiles, con locación/categoría y dato de contacto.

- **Edición de perfil**:
  - Campos editables (texto):
    - Teléfonos.
    - Mail.
    - Observaciones de contacto.
    - Habilidades.
    - Idiomas.
    - Experiencia actoral.
    - Link a reel.
    - Redes.
    - Disponibilidad horaria.
    - Interés en ser extra.
    - Libreta de conducir.
  - Mapeo exacto de columnas:
    - No se renombra nada. El front determina si existe `IDIOMAS` o `IDOMAS`, `EXPERIENCIA ACTORAL` o `EXPERIENCIA EN ACTUACIÓN`, etc., y escribe en esa columna exacta.
  - Guardar:
    - `POST` a Apps Script con `rowRef` (sheetKey + rowIndex) y `updates` (objeto `{ "Nombre exacto columna": "valor" }`).

### 7. Scripts de desarrollo

Instalar dependencias:

```bash
npm install
```

Desarrollo:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Arrancar en producción local:

```bash
npm run start
```

### 8. Notas sobre robustez de columnas

- Los nombres de columnas se usan **literalmente** según fueron provistos:
  - Ejemplos: `TATUAJES` / `TUTUAJES`, `IDIOMAS` / `IDOMAS`, `EXPERIENCIA ACTORAL` / `EXPERIENCIA EN ACTUACIÓN`, `DISPONIBILIDAD HORARIA` / `QUE DISPONIBILIDAD HORARIA TENES`, etc.
- El render nunca rompe si falta una columna:
  - Si un campo normalizado no existe, simplemente se omite en la UI.
  - Cualquier columna no mapeada explícitamente aparece en `extraFields` y se muestra en la sección “Otros campos” del modal.


