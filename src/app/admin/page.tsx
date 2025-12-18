"use client";

import { useEffect, useMemo, useState } from "react";
import { NormalizedProfile, normalizeProfile } from "@/lib/normalize";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type EditableKeys =
  | "phones"
  | "email"
  | "notes"
  | "skills"
  | "languages"
  | "actingExperience"
  | "reelLink"
  | "socialLinks"
  | "availability"
  | "wantsExtras"
  | "driverLicense";

type EditableState = Partial<Record<EditableKeys, string>>;

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [savedPassword, setSavedPassword] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<NormalizedProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [editable, setEditable] = useState<EditableState>({});

  const loggedIn = !!savedPassword;

  useEffect(() => {
    const stored = window.localStorage.getItem("admin-password");
    if (stored) {
      setSavedPassword(stored);
    }
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    async function load() {
      try {
        setLoading(true);
        const url = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;
        if (!url) {
          setError("Falta configurar NEXT_PUBLIC_APPS_SCRIPT_URL");
          setLoading(false);
          return;
        }
        const res = await fetch(url, {
          redirect: "follow"
        });
        if (!res.ok) throw new Error("Error al cargar datos");
        const data = await res.json();
        
        // El Apps Script devuelve { profiles: [...] } donde cada elemento tiene:
        // { location, category, rowRef: { sheetKey, rowIndex }, raw: {...} }
        const rawProfiles = Array.isArray(data.profiles) ? data.profiles : [];
        
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
        
        setProfiles(normalized);
      } catch (e: any) {
        setError(e.message ?? "Error desconocido");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [loggedIn]);

  const selected = useMemo(
    () => profiles.find((p) => p.id === selectedId) ?? null,
    [profiles, selectedId]
  );

  useEffect(() => {
    if (!selected) return;
    const state: EditableState = {
      phones: selected.phones ?? "",
      email: selected.email ?? "",
      notes: selected.notes ?? "",
      skills: selected.skills ?? "",
      languages: selected.languages ?? "",
      actingExperience: selected.actingExperience ?? "",
      reelLink: selected.reelLink ?? "",
      socialLinks: selected.socialLinks ?? "",
      availability: selected.availability ?? "",
      wantsExtras: selected.wantsExtras ?? "",
      driverLicense: selected.driverLicense ?? ""
    };
    setEditable(state);
  }, [selected]);

  const filtered = useMemo(() => {
    if (!search.trim()) return profiles;
    const q = search.toLowerCase();
    return profiles.filter((p) =>
      [p.fullName, p.cityCountry, p.email, p.phones]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [profiles, search]);

  async function handleSave() {
    if (!selected || !savedPassword) return;
    setSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      const url = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL;
      if (!url) throw new Error("Falta configurar NEXT_PUBLIC_APPS_SCRIPT_URL");

      const updates: Record<string, string> = {};

      // Mapear campos editables a nombres de columnas exactas
      if (editable.phones !== undefined) {
        // Separamos en dos números si es posible, pero sin romper nada
        updates["NÚMERO DE CONTACTO"] = editable.phones;
      }
      if (editable.email !== undefined) {
        updates["MAIL"] = editable.email;
      }
      if (editable.notes !== undefined) {
        updates["OBSERVACIÓN DE CONTACTO"] =
          editable.notes ||
          selected.raw["OBSERVACIÓN DE CONTACTO"] ||
          selected.raw["OBSERVACION DE CONTACTO"] ||
          "";
      }
      if (editable.skills !== undefined) {
        updates["HABILIDADES"] = editable.skills;
      }
      if (editable.languages !== undefined) {
        if ("IDIOMAS" in selected.raw) {
          updates["IDIOMAS"] = editable.languages;
        } else if ("IDOMAS" in selected.raw) {
          updates["IDOMAS"] = editable.languages;
        } else {
          updates["IDIOMAS"] = editable.languages;
        }
      }
      if (editable.actingExperience !== undefined) {
        if ("EXPERIENCIA ACTORAL" in selected.raw) {
          updates["EXPERIENCIA ACTORAL"] = editable.actingExperience;
        } else if ("EXPERIENCIA EN ACTUACIÓN" in selected.raw) {
          updates["EXPERIENCIA EN ACTUACIÓN"] = editable.actingExperience;
        } else {
          updates["EXPERIENCIA ACTORAL"] = editable.actingExperience;
        }
      }
      if (editable.reelLink !== undefined) {
        updates["LINK A REEL"] = editable.reelLink;
      }
      if (editable.socialLinks !== undefined) {
        updates["LINK A TU REDES"] = editable.socialLinks;
      }
      if (editable.availability !== undefined) {
        if ("DISPONIBILIDAD HORARIA" in selected.raw) {
          updates["DISPONIBILIDAD HORARIA"] = editable.availability;
        } else if ("QUE DISPONIBILIDAD HORARIA TENES" in selected.raw) {
          updates["QUE DISPONIBILIDAD HORARIA TENES"] = editable.availability;
        } else {
          updates["DISPONIBILIDAD HORARIA"] = editable.availability;
        }
      }
      if (editable.wantsExtras !== undefined) {
        if ("TE INTERESA SER EXTRA" in selected.raw) {
          updates["TE INTERESA SER EXTRA"] = editable.wantsExtras;
        } else if ("INTERES EN SER EXTRA" in selected.raw) {
          updates["INTERES EN SER EXTRA"] = editable.wantsExtras;
        } else {
          updates["TE INTERESA SER EXTRA"] = editable.wantsExtras;
        }
      }
      if (editable.driverLicense !== undefined) {
        updates["LIBRETA DE CONDUCIR"] = editable.driverLicense;
      }

      const body = {
        action: "update",
        rowRef: selected.rowRef,
        updates,
        adminSecret: savedPassword
      };

      // Enviar como texto plano sin Content-Type personalizado para evitar preflight CORS
      const res = await fetch(url, {
        method: "POST",
        redirect: "follow",
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Error al guardar");
      }
      setSaveMessage("Cambios guardados correctamente");
    } catch (e: any) {
      setError(e.message ?? "Error desconocido");
    } finally {
      setSaving(false);
    }
  }

  if (!loggedIn) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-background to-slate-100 flex items-center justify-center">
        <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-soft ring-1 ring-slate-200">
          <h1 className="text-lg font-semibold tracking-tight mb-2">
            Acceso administración
          </h1>
          <p className="text-xs text-muted-foreground mb-4">
            Ingresá la clave de administración para editar perfiles.
          </p>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!password.trim()) return;
              setSavedPassword(password.trim());
              window.localStorage.setItem("admin-password", password.trim());
            }}
          >
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                Clave
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Entrar
            </Button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-slate-100">
      <div className="container-narrow py-6 space-y-4">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Admin de perfiles
            </h1>
            <p className="text-xs text-muted-foreground">
              Editá datos de contacto, habilidades y links. Los cambios se guardan directamente en la hoja original.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSavedPassword(null);
              window.localStorage.removeItem("admin-password");
            }}
          >
            Cerrar sesión
          </Button>
        </header>

        <section className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="space-y-3">
            <div className="space-y-2 rounded-2xl bg-white/80 p-3 ring-1 ring-slate-200">
              <Input
                placeholder="Buscar por nombre, mail, teléfono..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                {filtered.length} perfiles encontrados
              </p>
            </div>
            <div className="h-[65vh] overflow-y-auto rounded-2xl bg-white/80 p-2 ring-1 ring-slate-200">
              {loading && (
                <p className="px-2 py-1 text-xs text-muted-foreground">
                  Cargando perfiles...
                </p>
              )}
              {!loading &&
                filtered.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={`w-full rounded-xl px-3 py-2 text-left text-xs transition ${
                      selectedId === p.id
                        ? "bg-slate-900 text-slate-50"
                        : "hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium line-clamp-1">
                        {p.fullName}
                      </span>
                      <span className="text-[10px] opacity-80">
                        {p.location} · {p.category}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-500 line-clamp-1">
                      {p.email || p.phones || p.cityCountry}
                    </div>
                  </button>
                ))}
            </div>
          </div>

          <div className="space-y-3 rounded-2xl bg-white/80 p-4 ring-1 ring-slate-200">
            {selected ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold">{selected.fullName}</h2>
                    <p className="text-[11px] text-muted-foreground">
                      {selected.location} · {selected.category}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedId(null)}
                  >
                    Cerrar ficha
                  </Button>
                </div>

                <div className="grid gap-3 text-xs">
                  <FieldEdit
                    label="Teléfonos"
                    value={editable.phones ?? ""}
                    onChange={(v) =>
                      setEditable((s) => ({ ...s, phones: v }))
                    }
                  />
                  <FieldEdit
                    label="Mail"
                    value={editable.email ?? ""}
                    onChange={(v) =>
                      setEditable((s) => ({ ...s, email: v }))
                    }
                  />
                  <FieldEdit
                    label="Observaciones de contacto"
                    value={editable.notes ?? ""}
                    multiline
                    onChange={(v) =>
                      setEditable((s) => ({ ...s, notes: v }))
                    }
                  />
                  <FieldEdit
                    label="Habilidades"
                    value={editable.skills ?? ""}
                    multiline
                    onChange={(v) =>
                      setEditable((s) => ({ ...s, skills: v }))
                    }
                  />
                  <FieldEdit
                    label="Idiomas"
                    value={editable.languages ?? ""}
                    onChange={(v) =>
                      setEditable((s) => ({ ...s, languages: v }))
                    }
                  />
                  <FieldEdit
                    label="Experiencia actoral"
                    value={editable.actingExperience ?? ""}
                    multiline
                    onChange={(v) =>
                      setEditable((s) => ({ ...s, actingExperience: v }))
                    }
                  />
                  <FieldEdit
                    label="Link a reel"
                    value={editable.reelLink ?? ""}
                    onChange={(v) =>
                      setEditable((s) => ({ ...s, reelLink: v }))
                    }
                  />
                  <FieldEdit
                    label="Redes"
                    value={editable.socialLinks ?? ""}
                    onChange={(v) =>
                      setEditable((s) => ({ ...s, socialLinks: v }))
                    }
                  />
                  <FieldEdit
                    label="Disponibilidad horaria"
                    value={editable.availability ?? ""}
                    onChange={(v) =>
                      setEditable((s) => ({ ...s, availability: v }))
                    }
                  />
                  <FieldEdit
                    label="Interés en ser extra"
                    value={editable.wantsExtras ?? ""}
                    onChange={(v) =>
                      setEditable((s) => ({ ...s, wantsExtras: v }))
                    }
                  />
                  <FieldEdit
                    label="Libreta de conducir"
                    value={editable.driverLicense ?? ""}
                    onChange={(v) =>
                      setEditable((s) => ({ ...s, driverLicense: v }))
                    }
                  />
                </div>

                {error && (
                  <p className="text-[11px] text-red-600 bg-red-50 border border-red-100 px-2 py-1 rounded-md">
                    {error}
                  </p>
                )}
                {saveMessage && (
                  <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-md">
                    {saveMessage}
                  </p>
                )}

                <div className="pt-2 flex justify-end">
                  <Button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? "Guardando..." : "Guardar cambios"}
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Seleccioná un perfil de la lista para editar sus campos clave.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function FieldEdit({
  label,
  value,
  onChange,
  multiline
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-medium text-slate-600">
        {label}
      </label>
      {multiline ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}


