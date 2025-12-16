import { Category, Location } from "@/config/sheets";

export type RowRef = {
  sheetKey: string;
  rowIndex: number;
};

export type BaseProfile = {
  id: string;
  location: Location;
  category: Category;
  rowRef: RowRef;
  raw: Record<string, string>;
  extraFields: Record<string, string>;
};

export type NormalizedProfile = BaseProfile & {
  fullName: string;
  age?: number;
  gender?: string;
  nationality?: string;
  cityCountry?: string;
  heightMeters?: number;
  weightKg?: number;
  shirtSize?: string;
  pantsSize?: string;
  shoeSize?: string;
  ethnicity?: string;
  eyeColor?: string;
  hairColor?: string;
  skinColor?: string;
  tattoos?: boolean;
  tattoosWhere?: string;
  skills?: string;
  languages?: string;
  actingExperience?: string;
  isProfessionalActor?: string;
  knowsActing?: string;
  wantsExtras?: string;
  driverLicense?: string;
  availability?: string;
  healthRestrictions?: string;
  healthIssues?: string;
  disability?: string;
  mainPhoto?: string;
  headshotPhoto?: string;
  mediumPhoto?: string;
  extraPhotos?: string[];
  reelLink?: string;
  socialLinks?: string;
  phones?: string;
  email?: string;
  notes?: string;
};

const TEXT_TRUE_VALUES = ["si", "sí", "true", "x"];

function parseNumber(value?: string): number | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(",", ".").replace(/[^\d.]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

export function computeAgeFromDate(dateStr?: string): number | undefined {
  if (!dateStr) return undefined;
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return undefined;
  const now = new Date();
  let age = now.getFullYear() - parsed.getFullYear();
  const m = now.getMonth() - parsed.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < parsed.getDate())) {
    age--;
  }
  return age >= 0 && age < 120 ? age : undefined;
}

function asBool(text?: string): boolean | undefined {
  if (!text) return undefined;
  const norm = text.trim().toLowerCase();
  if (TEXT_TRUE_VALUES.includes(norm)) return true;
  if (["no", "false"].includes(norm)) return false;
  return undefined;
}

export function buildId(location: Location, category: Category, rowRef: RowRef) {
  return `${location}-${category}-${rowRef.sheetKey}-${rowRef.rowIndex}`;
}

/**
 * Convierte un link de Google Drive a una URL pública accesible para imágenes.
 * Acepta varios formatos:
 * - https://drive.google.com/file/d/FILE_ID/view
 * - https://drive.google.com/open?id=FILE_ID
 * - https://docs.google.com/uc?export=view&id=FILE_ID
 * - Solo el FILE_ID
 * 
 * Usa el formato de thumbnail de Google Drive que funciona mejor con archivos compartidos.
 */
function convertDriveLinkToPublicUrl(link?: string): string | undefined {
  if (!link) return undefined;
  
  const trimmed = link.trim();
  if (!trimmed) return undefined;
  
  // Si ya es una URL pública válida de imagen (http/https), devolverla tal cual
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    // Si ya es una URL de imagen pública directa, devolverla
    if (trimmed.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i)) {
      return trimmed;
    }
    
    // Si es un link de Drive, extraer el ID
    let fileId: string | null = null;
    
    // Formato: https://drive.google.com/file/d/FILE_ID/view o /preview
    const match1 = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match1) {
      fileId = match1[1];
    }
    
    // Formato: https://drive.google.com/open?id=FILE_ID
    if (!fileId) {
      const match2 = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (match2) {
        fileId = match2[1];
      }
    }
    
    // Si encontramos un ID, usar el CDN de Google que permite hotlinking
    if (fileId) {
      return `https://lh3.googleusercontent.com/d/${fileId}`;
    }
    
    // Si no es un link de Drive reconocido, devolverlo tal cual (puede ser otra URL)
    return trimmed;
  }
  
  // Si no empieza con http, asumir que es un ID de archivo de Drive
  // Limpiar el string para obtener solo el ID
  const cleanId = trimmed.replace(/[^a-zA-Z0-9_-]/g, "");
  if (cleanId.length > 10) {
    return `https://lh3.googleusercontent.com/d/${cleanId}`;
  }
  
  return undefined;
}

export function normalizeProfile(args: {
  location: Location;
  category: Category;
  sheetKey: string;
  rowIndex: number;
  row: Record<string, string>;
}): NormalizedProfile {
  const { location, category, sheetKey, rowIndex, row } = args;

  const name =
    row["NOMBRES"] ||
    row["NOMBRE"] ||
    row["NOMBRES DEL MENOR"] ||
    "";
  const lastName =
    row["APELLIDOS"] ||
    row["APELLIDOS DEL MENOR"] ||
    "";
  const fullName = [name, lastName].filter(Boolean).join(" ").trim() || "Sin nombre";

  const age =
    parseNumber(row["EDAD"]) ??
    computeAgeFromDate(row["FECHA DE NACIMIENTO"]) ??
    computeAgeFromDate(row["FECHA DE NACIMIENTO DEL MENOR"]);

  const heightMeters = parseNumber(row["ALTURA EN METROS"]);
  const weightKg = parseNumber(row["PESO EN KG"]);

  const tattoos =
    asBool(row["TATUAJES"]) ??
    asBool(row["TUTUAJES"]);

  const rowRef: RowRef = { sheetKey, rowIndex };
  const id = buildId(location, category, rowRef);

  const knownKeys = new Set<string>([
    "Dirección de correo electrónico",
    "Marca temporal",
    "SOS ACTOR PROFESIONAL",
    "DÓNDE ESTUDIASTE ACTUACIÓN",
    "EXPERIENCIA ACTORAL",
    "FOTO INDIVIDUAL PLANO ENTERO FONDO LISO",
    "FOTO INDIVIDUAL PRIMER PLANO FONDO LISO",
    "NOMBRES",
    "APELLIDOS",
    "NÚMERO DE CONTACTO",
    "CIUDAD Y PAÍS DE RESIDENCIA",
    "EDAD",
    "ALTURA EN METROS",
    "CEDULA DE IDENTIDAD (SIN PUNTOS NI GUIONES)",
    "MAIL",
    "OTRO DOCUMENTO DE IDENTIDAD",
    "NACIONALIDAD",
    "GÉNERO",
    "OBSERVACION DE CONTACTO",
    "OTRO NÚMERO DE CONTACTO",
    "OBSERVACIÓN DE CONTACTO",
    "ETNIA",
    "PESO EN KG",
    "TALLE DE CAMISA",
    "TTALLE DE CAMISA",
    "TALLE DE PANTALÓN",
    "TALLE DE CALZADO",
    "TATUAJES",
    "TUTUAJES",
    "SI TU RESPUESTA ANTERIOR FUE SI, DÓNDE TENÉS",
    "TE INTERESA SER EXTRA",
    "INTERES EN SER EXTRA",
    "LIBRETA DE CONDUCIR",
    "HABILIDADES",
    "IDIOMAS",
    "IDOMAS",
    "RESTRICCIONES ALIMENTICIAS",
    "PROBLEMA DE SALUD A SABER",
    "DISCAPACIDAD A SABER",
    "DISPONIBILIDAD HORARIA",
    "QUE DISPONIBILIDAD HORARIA TENES",
    "FOTO INDIVIDUAL PLANO MEDIO FONDO LISO",
    "FOTOS ADICIONALES",
    "LINK A REEL",
    "LINK A TU REDES",
    "Observaciones",
    "FECHA DE NACIMIENTO",
    "DOCUMENTO DE IDENTIDAD (SIN PUNTOS NI GUIONES)",
    "DOMICILIO",
    "COLOR DE OJOS",
    "COLOR DE PELO",
    "COLOR DE PIEL",
    "PROFESIÓN U OCUPACIÓN",
    "SABES ACTUAR",
    "BARRIO",
    "CÉDULA DE IDENTIDAD (SIN PUNTOS NI GUIONES)",
    "NOMBRES DEL MENOR",
    "APELLIDOS DEL MENOR",
    "FECHA DE NACIMIENTO DEL MENOR",
    "NOMBRE Y APELLIDO DE AMBOS PADRES O MADRES",
    "DOMICILIO DEL MENOR",
    "COLOR DE CABELLO",
    "FOTO DE LA CEDULA DEL PADRE/MADRE/TUTOR A CARGO"
  ]);

  const extraFields: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!v) continue;
    if (!knownKeys.has(k)) {
      extraFields[k] = v;
    }
  }

  const profile: NormalizedProfile = {
    id,
    location,
    category,
    rowRef,
    raw: row,
    extraFields,
    fullName,
    age,
    gender: row["GÉNERO"],
    nationality: row["NACIONALIDAD"],
    cityCountry: row["CIUDAD Y PAÍS DE RESIDENCIA"],
    heightMeters,
    weightKg,
    shirtSize: row["TALLE DE CAMISA"] || row["TTALLE DE CAMISA"],
    pantsSize: row["TALLE DE PANTALÓN"],
    shoeSize: row["TALLE DE CALZADO"],
    ethnicity: row["ETNIA"],
    eyeColor: row["COLOR DE OJOS"],
    hairColor: row["COLOR DE PELO"] || row["COLOR DE CABELLO"],
    skinColor: row["COLOR DE PIEL"],
    tattoos,
    tattoosWhere: row["SI TU RESPUESTA ANTERIOR FUE SI, DÓNDE TENÉS"],
    skills: row["HABILIDADES"],
    languages: row["IDIOMAS"] || row["IDOMAS"],
    actingExperience: row["EXPERIENCIA ACTORAL"] || row["EXPERIENCIA EN ACTUACIÓN"],
    isProfessionalActor: row["SOS ACTOR PROFESIONAL"],
    knowsActing: row["SABES ACTUAR"],
    wantsExtras:
      row["TE INTERESA SER EXTRA"] ||
      row["INTERES EN SER EXTRA"],
    driverLicense: row["LIBRETA DE CONDUCIR"],
    availability:
      row["DISPONIBILIDAD HORARIA"] ||
      row["QUE DISPONIBILIDAD HORARIA TENES"],
    healthRestrictions: row["RESTRICCIONES ALIMENTICIAS"],
    healthIssues: row["PROBLEMA DE SALUD A SABER"],
    disability: row["DISCAPACIDAD A SABER"],
    mainPhoto: convertDriveLinkToPublicUrl(
      row["FOTO INDIVIDUAL PLANO ENTERO FONDO LISO"] ||
      row["FOTO INDIVIDUAL PRIMER PLANO FONDO LISO"]
    ),
    headshotPhoto: convertDriveLinkToPublicUrl(
      row["FOTO INDIVIDUAL PRIMER PLANO FONDO LISO"]
    ),
    mediumPhoto: convertDriveLinkToPublicUrl(
      row["FOTO INDIVIDUAL PLANO MEDIO FONDO LISO"]
    ),
    extraPhotos: row["FOTOS ADICIONALES"]
      ? row["FOTOS ADICIONALES"]
          .split(/\s*,\s*|\s+/)
          .filter(Boolean)
          .map(convertDriveLinkToPublicUrl)
          .filter((url): url is string => !!url)
      : [],
    reelLink: row["LINK A REEL"],
    socialLinks: row["LINK A TU REDES"],
    phones: [row["NÚMERO DE CONTACTO"], row["OTRO NÚMERO DE CONTACTO"]]
      .filter(Boolean)
      .join(" / "),
    email: row["MAIL"] || row["Dirección de correo electrónico"],
    notes:
      row["OBSERVACION DE CONTACTO"] ||
      row["OBSERVACIÓN DE CONTACTO"] ||
      row["Observaciones"]
  };

  return profile;
}


