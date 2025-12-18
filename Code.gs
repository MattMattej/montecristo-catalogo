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
    sheetName: "Respuestas de formulario 1" // Nombre por defecto de Google Forms
  },
  {
    key: "montevideo-casting",
    location: "Montevideo",
    category: "CASTING",
    spreadsheetId: "1SPb5_EQWuGXxxB3Uy32L7LVrcehqeo2E8w2c0pXiFnc",
    sheetName: "Respuestas de formulario 1"
  },
  {
    key: "montevideo-extras",
    location: "Montevideo",
    category: "EXTRAS",
    spreadsheetId: "1agFoOoo6fqhiysRzWwipOwsoerFc6HxDf4s0JdxIAKI",
    sheetName: "Respuestas de formulario 1"
  },
  {
    key: "montevideo-menores",
    location: "Montevideo",
    category: "MENORES",
    spreadsheetId: "18BBUYX_ADJV9rIuqy2F0CBI9jE2CAAH1JLhhhPG_b_s",
    sheetName: "Respuestas de formulario 1"
  },
  {
    key: "punta-actores",
    location: "Punta del Este",
    category: "ACTORES",
    spreadsheetId: "1KYBWuk158ASdvZGUtI0Haw_ulC3x5EFCCVm4e5jTX1M",
    sheetName: "Respuestas de formulario 1"
  },
  {
    key: "punta-casting",
    location: "Punta del Este",
    category: "CASTING",
    spreadsheetId: "1B_X87-Rh5rvGPdZXVo3_ffnCObWBnQp3pde4WuE94PE",
    sheetName: "Respuestas de formulario 1"
  },
  {
    key: "punta-extras",
    location: "Punta del Este",
    category: "EXTRAS",
    spreadsheetId: "1agFoOoo6fqhiysRzWwipOwsoerFc6HxDf4s0JdxIAKI",
    sheetName: "Respuestas de formulario 1"
  },
  {
    key: "punta-menores",
    location: "Punta del Este",
    category: "MENORES",
    spreadsheetId: "1R5i_K9P-CGAdDxuElsQ9kMJeJvwpVZeK8UhOULmd95E",
    sheetName: "Respuestas de formulario 1"
  }
];

// Función auxiliar para agregar headers CORS
function setCORSHeaders(output) {
  return output
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
}

// Manejar peticiones OPTIONS (preflight CORS)
function doOptions() {
  return setCORSHeaders(ContentService.createTextOutput(''));
}

function doGet(e) {
  try {
    const all = [];
    const errors = [];
    const debug = [];

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
          
          // Intentar nombres comunes de Google Forms
          const alternativeNames = [
            "Respuestas de formulario 1",
            "Respuestas de formulario",
            "Form Responses 1",
            "Form Responses",
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
          
          // Si aún no la encuentra, usar la primera sheet disponible
          if (!sh && sheetNames.length > 0) {
            debug.push(`  Usando la primera sheet disponible: "${sheetNames[0]}"`);
            sh = ss.getSheetByName(sheetNames[0]);
          }
          
          if (!sh) {
            errors.push(`${def.key}: No se pudo encontrar ninguna sheet. Sheets disponibles: ${sheetNames.join(", ")}`);
            debug.push(`  ERROR: No se pudo encontrar ninguna sheet`);
            return;
          }
        }
        
        debug.push(`  ✓ Sheet encontrada`);
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

    return setCORSHeaders(
      ContentService.createTextOutput(JSON.stringify(result))
    );
  } catch (e) {
    const errorPayload = { 
      error: String(e),
      stack: e.stack || "No stack trace"
    };
    return setCORSHeaders(
      ContentService.createTextOutput(JSON.stringify(errorPayload))
    );
  }
}

function doPost(e) {
  try {
    const contentType = e.postData && e.postData.type;
    var body;
    if (contentType === "application/json") {
      body = JSON.parse(e.postData.contents);
    } else {
      body = JSON.parse(e.postData.getDataAsString());
    }

    const secret = body.adminSecret;

    if (!secret || secret !== CONFIG.ADMIN_PASSWORD) {
      return setCORSHeaders(
        ContentService.createTextOutput(JSON.stringify({ error: "UNAUTHORIZED" }))
      );
    }

    if (body.action === "update") {
      return handleUpdate(body);
    }

    return setCORSHeaders(
      ContentService.createTextOutput(JSON.stringify({ error: "UNKNOWN_ACTION" }))
    );
  } catch (e2) {
    const errorPayload = { error: String(e2) };
    return setCORSHeaders(
      ContentService.createTextOutput(JSON.stringify(errorPayload))
    );
  }
}

function handleUpdate(body) {
  const rowRef = body.rowRef;
  const updates = body.updates || {};

  if (!rowRef || !rowRef.sheetKey || !rowRef.rowIndex) {
    return setCORSHeaders(
      ContentService.createTextOutput(JSON.stringify({ error: "INVALID_ROW_REF" }))
    );
  }

  const def = SHEETS.filter(function (d) {
    return d.key === rowRef.sheetKey;
  })[0];

  if (!def) {
    return setCORSHeaders(
      ContentService.createTextOutput(JSON.stringify({ error: "SHEET_NOT_FOUND" }))
    );
  }

  const ss = SpreadsheetApp.openById(def.spreadsheetId);
  const sh = ss.getSheetByName(def.sheetName);
  if (!sh) {
    return setCORSHeaders(
      ContentService.createTextOutput(JSON.stringify({ error: "SHEET_NOT_FOUND" }))
    );
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

  return setCORSHeaders(
    ContentService.createTextOutput(JSON.stringify({ ok: true }))
  );
}
