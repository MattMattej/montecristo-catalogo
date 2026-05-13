const CONFIG = {
  // Clave que vas a usar también en el frontend admin (se envía en el body).
  ADMIN_PASSWORD: "remolacha3"
};

// Opción B: cada combinación location+category apunta a un Spreadsheet propio
// y a la pestaña de respuestas correspondiente.
// Rellená cada spreadsheetId con el ID real del archivo en Drive.
const SHEETS = [
  {
    key: "montevideo-actores",
    location: "Montevideo",
    category: "ACTORES",
    spreadsheetId: "1KYBWuk158ASdvZGUtI0Haw_ulC3x5EFCCVm4e5jTX1M",
    sheetName: "Montevideo – 1a ACTORES"
  },
  {
    key: "montevideo-casting",
    location: "Montevideo",
    category: "CASTING",
    spreadsheetId: "1SPb5_EQWuGXxxB3Uy32L7LVrcehqeo2E8w2c0pXiFnc",
    sheetName: "Montevideo – 1b CASTING"
  },
  {
    key: "montevideo-extras",
    location: "Montevideo",
    category: "EXTRAS",
    spreadsheetId: "1agFoOoo6fqhiysRzWwipOwsoerFc6HxDf4s0JdxIAKI",
    sheetName: "Montevideo – 1c EXTRAS"
  },
  {
    key: "montevideo-menores",
    location: "Montevideo",
    category: "MENORES",
    spreadsheetId: "18BBUYX_ADJV9rIuqy2F0CBI9jE2CAAH1JLhhhPG_b_s",
    sheetName: "Montevideo – 1d MENORES"
  },
  {
    key: "punta-actores",
    location: "Punta del Este",
    category: "ACTORES",
    spreadsheetId: "1Vri9qKjOZV6bgSBSQALCJ-TypOwO7DIWrF4WGq230qA",
    sheetName: "Punta del Este – 2a ACTORES"
  },
  {
    key: "punta-casting",
    location: "Punta del Este",
    category: "CASTING",
    spreadsheetId: "1B_X87-Rh5rvGPdZXVo3_ffnCObWBnQp3pde4WuE94PE",
    sheetName: "Punta del Este – 2b CASTING"
  },
  {
    key: "punta-extras",
    location: "Punta del Este",
    category: "EXTRAS",
    spreadsheetId: "1h4EVIjUMduc6cUyOnZa7mUmkBTKmwieA8YxiLe7aLM4",
    sheetName: "Punta del Este – 2c EXTRAS"
  },
  {
    key: "punta-menores",
    location: "Punta del Este",
    category: "MENORES",
    spreadsheetId: "1R5i_K9P-CGAdDxuElsQ9kMJeJvwpVZeK8UhOULmd95E",
    sheetName: "Punta del Este – 2d MENORES"
  }
];

// Función auxiliar para crear respuesta con CORS
// Nota: ContentService no soporta setHeader(), los headers CORS deben configurarse
// en la configuración del Web App (desplegar como "Cualquiera, incluso anónimo")
function createCORSResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Manejar peticiones OPTIONS (preflight CORS)
function doOptions() {
  return ContentService
    .createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doGet(e) {
  try {
    const all = [];
    const errors = [];
    const debug = [];
    const processedSheets = [];

    SHEETS.forEach(function (def) {
      try {
        debug.push(`Procesando: ${def.key} (${def.location} - ${def.category})`);
        
        if (!def.spreadsheetId) {
          errors.push(`${def.key}: No spreadsheetId configurado`);
          debug.push(`  ERROR: No spreadsheetId`);
          return;
        }
        
        debug.push(`  Intentando abrir spreadsheet: ${def.spreadsheetId}`);
        
        let ss;
        try {
          ss = SpreadsheetApp.openById(def.spreadsheetId);
          debug.push(`  ✓ Spreadsheet abierto correctamente`);
        } catch (openError) {
          errors.push(`${def.key}: No se pudo abrir spreadsheet ${def.spreadsheetId} - ${String(openError)}`);
          debug.push(`  ERROR al abrir: ${String(openError)}`);
          return;
        }
        
        debug.push(`  Buscando sheet: "${def.sheetName}"`);
        let sh = ss.getSheetByName(def.sheetName);
        
        // Si no encuentra la sheet con el nombre especificado, intentar nombres alternativos comunes
        if (!sh) {
          const allSheets = ss.getSheets();
          const sheetNames = allSheets.map(function(s) { return s.getName(); });
          debug.push(`  Sheet "${def.sheetName}" no encontrada. Intentando nombres alternativos...`);
          debug.push(`  Sheets disponibles: ${sheetNames.join(", ")}`);
          
          // Intentar nombres comunes de Google Forms y variaciones de guiones
          const alternativeNames = [
            "Respuestas de formulario 1",
            "Respuesta de formulario 1", // Versión singular
            "Respuestas de formulario",
            "Respuesta de formulario",
            "Form Responses 1",
            "Form Responses",
            def.sheetName.replace(/[–—]/g, "-"), // Cambiar guión largo por corto
            def.sheetName.replace(/-/g, "–"),    // Cambiar guión corto por largo
            def.sheetName.toLowerCase(),
            def.sheetName.toUpperCase()
          ];
          
          for (var altIdx = 0; altIdx < alternativeNames.length; altIdx++) {
            const altName = alternativeNames[altIdx];
            if (sheetNames.indexOf(altName) !== -1) {
              sh = ss.getSheetByName(altName);
              if (sh) {
                debug.push(`  ✓ Sheet encontrada con nombre alternativo: "${altName}"`);
                break;
              }
            }
          }

          // Búsqueda por proximidad (último recurso): que el nombre contenga la ciudad Y la categoría
          if (!sh) {
            const locationTerm = def.location.toLowerCase();
            const categoryTerm = def.category.toLowerCase();
            
            for (var sIdx = 0; sIdx < allSheets.length; sIdx++) {
              const currentName = allSheets[sIdx].getName().toLowerCase();
              // Si el nombre de la pestaña contiene tanto la ciudad como la categoría, es muy probable que sea la correcta
              if (currentName.indexOf(locationTerm) !== -1 && currentName.indexOf(categoryTerm) !== -1) {
                sh = allSheets[sIdx];
                debug.push(`  ✓ Sheet encontrada por proximidad: "${sh.getName()}"`);
                break;
              }
            }
          }
          
          // Si aún no la encuentra, NO usar la primera sheet disponible para evitar mezclar datos de diferentes categorías
          if (!sh) {
            errors.push(`${def.key}: No se encontró la pestaña "${def.sheetName}" ni nombres alternativos. Se salta esta hoja para evitar mostrar datos incorrectos.`);
            debug.push(`  ERROR CRÍTICO: No se encontró la pestaña "${def.sheetName}". SALTANDO.`);
            return;
          }
        }
        
        const finalSheetName = sh.getName();
        const sheetId = sh.getSheetId();
        const sheetPath = def.spreadsheetId + "/" + sheetId;
        
        if (processedSheets.indexOf(sheetPath) !== -1) {
          debug.push(`  WARNING: La pestaña "${finalSheetName}" (ID: ${sheetId}) ya fue procesada en esta petición. Saltando para evitar duplicados.`);
          return;
        }
        processedSheets.push(sheetPath);

        debug.push(`  ✓ Usando sheet: "${finalSheetName}" (ID: ${sheetId})`);
        const range = sh.getDataRange();
        const values = range.getValues();
        
        if (values.length < 2) {
          errors.push(`${def.key}: Sheet vacía o sin datos (solo ${values.length} fila(s))`);
          debug.push(`  WARNING: Sheet vacía`);
          return;
        }
        
        debug.push(`  Procesando ${values.length - 1} filas de datos`);
        const headers = values[0];
        let rowCount = 0;

        for (var i = 1; i < values.length; i++) {
          var rowValues = values[i];
          if (rowValues.join("").trim() === "") continue;
          var rowObj = {};
          for (var c = 0; c < headers.length; c++) {
            var key = String(headers[c] || "").trim();
            if (!key) continue;
            rowObj[key] = rowValues[c] != null ? String(rowValues[c]) : "";
          }
          var rowRef = {
            sheetKey: def.key,
            rowIndex: i + 1
          };
          var profile = {
            location: def.location,
            category: def.category,
            rowRef: rowRef,
            raw: rowObj
          };
          all.push(profile);
          rowCount++;
        }
        
        debug.push(`  ✓ ${rowCount} perfiles procesados de ${def.key}`);
      } catch (sheetError) {
        const errorMsg = `${def.key} (${def.location} - ${def.category}): ${String(sheetError)}`;
        errors.push(errorMsg);
        debug.push(`  ERROR: ${errorMsg}`);
      }
    });

    const result = { 
      profiles: all,
      debug: debug
    };
    
    if (errors.length > 0) {
      result.warnings = errors;
    }

    return createCORSResponse(result);
  } catch (e) {
    const errorPayload = { 
      error: String(e),
      stack: e.stack || "No stack trace"
    };
    return createCORSResponse(errorPayload);
  }
}

function doPost(e) {
  try {
    // Intentar parsear el body como JSON (puede venir sin Content-Type o con diferentes tipos)
    var body;
    try {
      if (e.postData && e.postData.contents) {
        body = JSON.parse(e.postData.contents);
      } else {
        body = JSON.parse(e.postData.getDataAsString());
      }
    } catch (parseError) {
      // Si falla, intentar desde e.parameter (form-urlencoded)
      var params = e.parameter;
      if (params && params.data) {
        body = JSON.parse(params.data);
      } else {
        throw new Error("No se pudo parsear el body: " + String(parseError));
      }
    }

    const secret = body.adminSecret;

    if (!secret || secret !== CONFIG.ADMIN_PASSWORD) {
      return createCORSResponse({ error: "UNAUTHORIZED" });
    }

    if (body.action === "update") {
      return handleUpdate(body);
    }

    return createCORSResponse({ error: "UNKNOWN_ACTION" });
  } catch (e2) {
    const errorPayload = { error: String(e2) };
    return createCORSResponse(errorPayload);
  }
}

function handleUpdate(body) {
  const rowRef = body.rowRef;
  const updates = body.updates || {};

  if (!rowRef || !rowRef.sheetKey || !rowRef.rowIndex) {
    return createCORSResponse({ error: "INVALID_ROW_REF" });
  }

  const def = SHEETS.filter(function (d) {
    return d.key === rowRef.sheetKey;
  })[0];

  if (!def) {
    return createCORSResponse({ error: "SHEET_NOT_FOUND" });
  }

  const ss = SpreadsheetApp.openById(def.spreadsheetId);
  const sh = ss.getSheetByName(def.sheetName);
  if (!sh) {
    return createCORSResponse({ error: "SHEET_NOT_FOUND" });
  }

  const headerRow = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const headerIndex = {};
  for (var c = 0; c < headerRow.length; c++) {
    var name = String(headerRow[c] || "").trim();
    if (name) {
      headerIndex[name] = c + 1;
    }
  }

  Object.keys(updates).forEach(function (key) {
    if (!(key in headerIndex)) {
      return;
    }
    var col = headerIndex[key];
    var value = updates[key];
    sh.getRange(rowRef.rowIndex, col).setValue(value);
  });

  return createCORSResponse({ ok: true });
}

/**
 * Función de utilidad para corregir los permisos de todas las fotos
 * registradas en las hojas de cálculo.
 * 
 * Se recomienda ejecutar esto manualmente desde el editor de Apps Script.
 */
function fixAllPermissions() {
  const photoColumns = [
    "FOTO INDIVIDUAL PLANO ENTERO FONDO LISO",
    "FOTO INDIVIDUAL PRIMER PLANO FONDO LISO",
    "FOTO INDIVIDUAL PLANO MEDIO FONDO LISO",
    "FOTOS ADICIONALES",
    "FOTO INDIVIDUAL PLANO ENTERO FONDO LISO ", // Con espacio extra
    "FOTO INDIVIDUAL PRIMER PLANO FONDO LISO ", 
    "FOTO INDIVIDUAL PLANO MEDIO FONDO LISO ",
    "FOTOS ADICIONALES "
  ];

  const processedFiles = new Set();

  SHEETS.forEach(function(def) {
    console.log("Revisando permisos en: " + def.key);
    try {
      const ss = SpreadsheetApp.openById(def.spreadsheetId);
      const sh = ss.getSheetByName(def.sheetName);
      if (!sh) {
        console.log("  No se encontró la pestaña: " + def.sheetName);
        return;
      }

      const data = sh.getDataRange().getValues();
      if (data.length < 2) return;

      const headers = data[0].map(h => String(h || "").trim());
      const indices = [];
      
      photoColumns.forEach(col => {
        const idx = headers.indexOf(col.trim());
        if (idx !== -1) indices.push(idx);
      });

      if (indices.length === 0) {
        console.log("  No se encontraron columnas de fotos.");
        return;
      }

      let count = 0;
      for (let i = 1; i < data.length; i++) {
        indices.forEach(idx => {
          const cellValue = String(data[i][idx] || "");
          if (!cellValue) return;

          const ids = extractDriveIds(cellValue);
          ids.forEach(id => {
            if (processedFiles.has(id)) return;
            processedFiles.add(id);
            
            try {
              const file = DriveApp.getFileById(id);
              file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
              count++;
            } catch (e) {
              // console.log("  Error con archivo " + id + ": " + e.message);
            }
          });
        });
      }
      console.log("  ✓ Se corrigieron " + count + " archivos en esta hoja.");
    } catch (e) {
      console.log("  Error procesando " + def.key + ": " + e.message);
    }
  });
  console.log("Proceso finalizado. Total archivos procesados: " + processedFiles.size);
}

function extractDriveIds(text) {
  const regex = /[a-zA-Z0-9_-]{28,}/g; // Los IDs suelen tener 33 caracteres
  const matches = text.match(regex);
  return matches ? matches : [];
}
