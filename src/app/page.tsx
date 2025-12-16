"use client";

import { useEffect, useMemo, useState } from "react";
import { NormalizedProfile, normalizeProfile } from "@/lib/normalize";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Category, Location } from "@/config/sheets";

type Filters = {
  search: string;
  locations: Location[];
  categories: Category[];
  gender: string[];
};

const PAGE_SIZE = 24;

export default function HomePage() {
  const [profiles, setProfiles] = useState<NormalizedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<NormalizedProfile | null>(null);
  const [page, setPage] = useState(1);

  const [filters, setFilters] = useState<Filters>({
    search: "",
    locations: [],
    categories: [],
    gender: []
  });

  useEffect(() => {
    async function load() {
      try {
        const url = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;
        if (!url) {
          setError("Falta configurar NEXT_PUBLIC_APPS_SCRIPT_URL");
          setLoading(false);
          return;
        }
        console.log("Fetching from URL:", url);
        const res = await fetch(url);
        console.log("Response status:", res.status, res.statusText);
        
        if (!res.ok) {
          const text = await res.text();
          console.error("Error response:", text);
          throw new Error(`Error al cargar datos: ${res.status} ${res.statusText}`);
        }
        
        const data = await res.json();
        
        // Debug: ver qué devuelve el Apps Script
        console.log("Apps Script response:", data);
        
        // Verificar si hay error en la respuesta
        if (data.error) {
          console.error("Apps Script error:", data.error);
          throw new Error(`Error del Apps Script: ${data.error}`);
        }
        
        // Mostrar warnings si los hay
        if (data.warnings && data.warnings.length > 0) {
          console.warn("Apps Script warnings:", data.warnings);
          // Mostrar warnings en la UI también
          setError(`Advertencias: ${data.warnings.join("; ")}`);
        }
        
        // Mostrar debug info si está disponible
        if (data.debug && data.debug.length > 0) {
          console.log("Apps Script debug info:", data.debug);
        }
        
        console.log("Profiles count:", data.profiles?.length || 0);
        
        // El Apps Script devuelve { profiles: [...] } donde cada elemento tiene:
        // { location, category, rowRef: { sheetKey, rowIndex }, raw: {...} }
        const rawProfiles = Array.isArray(data.profiles) ? data.profiles : [];
        
        if (rawProfiles.length === 0) {
          console.warn("No se encontraron perfiles en la respuesta");
          console.warn("Data structure:", Object.keys(data));
        }
        
        // Normalizar cada perfil
        const normalized: NormalizedProfile[] = rawProfiles.map((p: any) => {
          return normalizeProfile({
            location: p.location,
            category: p.category,
            sheetKey: p.rowRef?.sheetKey || "",
            rowIndex: p.rowRef?.rowIndex || 0,
            row: p.raw || {}
          });
        });
        
        console.log("Normalized profiles:", normalized.length);
        if (normalized.length > 0) {
          console.log("Sample profile:", normalized[0]);
        }
        
        // shuffle simple
        for (let i = normalized.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [normalized[i], normalized[j]] = [normalized[j], normalized[i]];
        }
        
        setProfiles(normalized);
      } catch (e: any) {
        setError(e.message ?? "Error desconocido");
        setProfiles([]); // Asegurar que siempre sea un array
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const genders = useMemo(
    () => {
      if (!Array.isArray(profiles) || profiles.length === 0) return [];
      return Array.from(
        new Set(
          profiles
            .map((p) => p.gender?.trim())
            .filter(Boolean) as string[]
        )
      ).sort();
    },
    [profiles]
  );

  const filtered = useMemo(() => {
    if (!Array.isArray(profiles)) return [];
    return profiles.filter((p) => {
      if (filters.locations.length && !filters.locations.includes(p.location)) {
        return false;
      }
      if (filters.categories.length && !filters.categories.includes(p.category)) {
        return false;
      }
      if (filters.gender.length && p.gender) {
        if (!filters.gender.includes(p.gender)) return false;
      }
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase();
        const haystack = [
          p.fullName,
          p.cityCountry,
          p.nationality,
          p.skills,
          p.languages
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [profiles, filters]);

  const visible = filtered.slice(0, page * PAGE_SIZE);

  const toggleArrayFilter = <T,>(
    key: keyof Filters,
    value: T
  ) => {
    setPage(1);
    setFilters((f) => {
      const current = (f[key] as unknown as T[]) ?? [];
      const exists = current.includes(value);
      const next = exists ? current.filter((v) => v !== value) : [...current, value];
      return { ...f, [key]: next };
    });
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-slate-100">
      <section className="container-narrow py-8 space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-medium tracking-[0.25em] uppercase text-slate-500">
            Montecristo Casting
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Catálogo de talentos
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Buscador unificado de actores, casting, extras y menores en Montevideo y Punta del Este.
          </p>
        </header>

        <section className="sticky top-0 z-10 mb-2 -mx-4 bg-gradient-to-b from-background/95 to-background/90 px-4 py-3 backdrop-blur">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex-1 flex gap-2">
              <Input
                placeholder="Buscar por nombre, ciudad, habilidades..."
                className="flex-1"
                value={filters.search}
                onChange={(e) => {
                  setPage(1);
                  setFilters((f) => ({ ...f, search: e.target.value }));
                }}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPage(1);
                  setFilters({
                    search: "",
                    locations: [],
                    categories: [],
                    gender: []
                  });
                }}
              >
                Limpiar filtros
              </Button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
            <div className="flex flex-wrap gap-1 text-xs items-center">
              <span className="font-medium text-slate-600">Locación:</span>
              {(["Montevideo", "Punta del Este"] as Location[]).map((loc) => (
                <button
                  key={loc}
                  className={`rounded-full border px-2.5 py-1 transition ${
                    filters.locations.includes(loc)
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white/70 hover:bg-white border-slate-200 text-slate-700"
                  }`}
                  onClick={() => toggleArrayFilter("locations", loc)}
                >
                  {loc}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1 text-xs items-center">
              <span className="font-medium text-slate-600">Categoría:</span>
              {(["ACTORES", "CASTING", "EXTRAS", "MENORES"] as Category[]).map(
                (cat) => (
                  <button
                    key={cat}
                    className={`rounded-full border px-2.5 py-1 transition ${
                      filters.categories.includes(cat)
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white/70 hover:bg-white border-slate-200 text-slate-700"
                    }`}
                    onClick={() => toggleArrayFilter("categories", cat)}
                  >
                    {cat}
                  </button>
                )
              )}
            </div>
            <div className="flex flex-wrap gap-1 text-xs items-center">
              <span className="font-medium text-slate-600">Género:</span>
              {genders.length > 0 ? (
                genders.map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={`rounded-full border px-2.5 py-1 transition ${
                      filters.gender.includes(g)
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white/70 hover:bg-white border-slate-200 text-slate-700"
                    }`}
                    onClick={() => toggleArrayFilter("gender", g)}
                  >
                    {g}
                  </button>
                ))
              ) : (
                <span className="text-slate-400 text-[10px]">No disponible</span>
              )}
            </div>
          </div>
        </section>

        {loading && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-2xl bg-card shadow-soft/30"
              >
                <Skeleton className="aspect-[3/4] w-full" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-2 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && !loading && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        {!loading && !error && (
          <>
            {profiles.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                <p>No se encontraron perfiles.</p>
                <p className="mt-2 text-xs">
                  Verifica que el Apps Script esté configurado correctamente y que haya datos en las sheets.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Mostrando <strong>{visible.length}</strong> de{" "}
                    <strong>{filtered.length}</strong> perfiles
                  </span>
                </div>

                <section className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
              {visible.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelected(p)}
                  className="group relative overflow-hidden rounded-2xl bg-card text-left shadow-soft/40 ring-1 ring-slate-200/60 transition hover:-translate-y-1 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                >
                  <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-100">
                    {p.headshotPhoto || p.mainPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.headshotPhoto || p.mainPhoto}
                        alt={p.fullName}
                        className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />
                    ) : null}
                    {!p.headshotPhoto && !p.mainPhoto && (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
                        Sin foto
                      </div>
                    )}
                  </div>
                  <div className="p-3 space-y-2">
                    <p className="text-xs font-medium leading-snug line-clamp-2">
                      {p.fullName}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {p.age && (
                        <Badge className="text-[10px]">
                          {p.age} años
                        </Badge>
                      )}
                      {p.heightMeters && (
                        <Badge className="text-[10px]">
                          {p.heightMeters.toFixed(2)} m
                        </Badge>
                      )}
                      {p.gender && (
                        <Badge className="text-[10px]">
                          {p.gender}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]">
                        {p.location} · {p.category}
                      </Badge>
                    </div>
                  </div>
                </button>
              ))}
            </section>

                {visible.length < filtered.length && (
                  <div className="flex justify-center py-6">
                    <Button
                      variant="outline"
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Cargar más
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </section>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <div>
                  <DialogTitle>{selected.fullName}</DialogTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selected.location} · {selected.category}
                    {selected.age && ` · ${selected.age} años`}
                    {selected.heightMeters && ` · ${selected.heightMeters.toFixed(2)} m`}
                  </p>
                </div>
                <DialogClose>✕</DialogClose>
              </DialogHeader>

              <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <div className="space-y-3">
                  {/* Foto principal: usar mainPhoto (plano entero) o headshotPhoto como fallback */}
                  {(selected.mainPhoto || selected.headshotPhoto) && (
                    <div className="overflow-hidden rounded-xl bg-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selected.mainPhoto || selected.headshotPhoto}
                        alt={selected.fullName}
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />
                    </div>
                  )}
                  
                  {/* Fotos adicionales: headshot, medium y extraPhotos */}
                  {(selected.headshotPhoto || selected.mediumPhoto || selected.extraPhotos.length > 0) && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-slate-600">
                        Fotos adicionales
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {/* Headshot si es diferente de mainPhoto */}
                        {selected.headshotPhoto && selected.headshotPhoto !== selected.mainPhoto && (
                          <div className="h-24 w-20 overflow-hidden rounded-lg bg-slate-100 flex-shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={selected.headshotPhoto}
                              alt="Primer plano"
                              className="h-full w-full object-cover"
                              referrerPolicy="no-referrer"
                              loading="lazy"
                            />
                          </div>
                        )}
                        {/* Medium photo */}
                        {selected.mediumPhoto && (
                          <div className="h-24 w-20 overflow-hidden rounded-lg bg-slate-100 flex-shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={selected.mediumPhoto}
                              alt="Plano medio"
                              className="h-full w-full object-cover"
                              referrerPolicy="no-referrer"
                              loading="lazy"
                            />
                          </div>
                        )}
                        {/* Extra photos */}
                        {selected.extraPhotos.map((url, i) => (
                          <div
                            key={i}
                            className="h-24 w-20 overflow-hidden rounded-lg bg-slate-100 flex-shrink-0"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt={`Foto adicional ${i + 1}`}
                              className="h-full w-full object-cover"
                              referrerPolicy="no-referrer"
                              loading="lazy"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {selected.reelLink && (
                    <a
                      href={selected.reelLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center text-xs font-medium text-slate-800 underline underline-offset-4"
                    >
                      Ver reel
                    </a>
                  )}
                </div>

                <div className="space-y-4 text-xs">
                  <Section title="Datos personales">
                    <Field label="Nombre completo" value={selected.fullName} />
                    <Field label="Edad" value={selected.age ? `${selected.age} años` : ""} />
                    <Field label="Género" value={selected.gender} />
                    <Field label="Nacionalidad" value={selected.nationality} />
                    <Field label="Ciudad y país" value={selected.cityCountry} />
                  </Section>

                  <Section title="Medidas">
                    <Field
                      label="Altura"
                      value={selected.heightMeters ? `${selected.heightMeters.toFixed(2)} m` : ""}
                    />
                    <Field
                      label="Peso"
                      value={selected.weightKg ? `${selected.weightKg} kg` : ""}
                    />
                    <Field label="Camisa" value={selected.shirtSize} />
                    <Field label="Pantalón" value={selected.pantsSize} />
                    <Field label="Calzado" value={selected.shoeSize} />
                  </Section>

                  <Section title="Apariencia">
                    <Field label="Ojos" value={selected.eyeColor} />
                    <Field label="Pelo" value={selected.hairColor} />
                    <Field label="Piel" value={selected.skinColor} />
                    <Field
                      label="Tatuajes"
                      value={
                        selected.tattoos === undefined
                          ? ""
                          : selected.tattoos
                          ? "Tiene"
                          : "No tiene"
                      }
                    />
                    <Field label="Ubicación tatuajes" value={selected.tattoosWhere} />
                  </Section>

                  <Section title="Skills e idiomas">
                    <Field label="Habilidades" value={selected.skills} />
                    <Field label="Idiomas" value={selected.languages} />
                  </Section>

                  <Section title="Experiencia">
                    <Field label="Experiencia actoral" value={selected.actingExperience} />
                    <Field label="Actor profesional" value={selected.isProfessionalActor} />
                    <Field label="Sabe actuar" value={selected.knowsActing} />
                    <Field label="Interés en ser extra" value={selected.wantsExtras} />
                    <Field label="Profesión/ocupación" value={selected.raw["PROFESIÓN U OCUPACIÓN"]} />
                  </Section>

                  <Section title="Logística">
                    <Field label="Libreta de conducir" value={selected.driverLicense} />
                    <Field label="Disponibilidad horaria" value={selected.availability} />
                  </Section>

                  <Section title="Salud">
                    <Field label="Restricciones alimenticias" value={selected.healthRestrictions} />
                    <Field label="Problemas de salud" value={selected.healthIssues} />
                    <Field label="Discapacidad" value={selected.disability} />
                  </Section>

                  <Section title="Contacto">
                    <Field label="Teléfonos" value={selected.phones} />
                    <Field label="Mail" value={selected.email} />
                    <Field label="Observaciones" value={selected.notes} />
                  </Section>

                  <Section title="Links">
                    <Field label="Redes" value={selected.socialLinks} />
                  </Section>

                  {Object.keys(selected.extraFields).length > 0 && (
                    <Section title="Otros campos">
                      <div className="grid gap-1">
                        {Object.entries(selected.extraFields).map(([k, v]) => (
                          <div key={k} className="flex gap-1">
                            <span className="font-medium">{k}:</span>
                            <span className="text-slate-700">{v}</span>
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}

function Section({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {title}
      </h3>
      <div className="rounded-xl bg-white/70 p-3 ring-1 ring-slate-200/80 space-y-1.5">
        {children}
      </div>
    </section>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-1 text-[11px] text-slate-700">
      <span className="font-medium text-slate-600">{label}:</span>
      <span>{value}</span>
    </div>
  );
}


