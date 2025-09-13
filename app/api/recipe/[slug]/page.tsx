"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

/* --- types must mirror your main page --- */
type IngredientGroup = { group?: string; items: string[] };
type RecipePayload = {
  mode: "recipe";
  title: string;
  servings?: number;
  time?: { prep?: string; cook?: string; total?: string };
  intro?: string;
  ingredients: IngredientGroup[];
  steps: string[];
  notes?: string[];
  used_ingredients?: string[];
  suggested_additions?: string[];
};

/* Quick helpers */
function unslugify(s: string) {
  return s
    .replace(/-/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .trim();
}

export default function RecipeDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [data, setData] = useState<RecipePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      try {
        setLoading(true);
        setError(null);
        const title = unslugify(slug);
        const res = await fetch("/api/recipe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: `Give me the full recipe for: ${title}`,
          }),
        });
        const json = await res.json();
        if (!res.ok || json?.mode !== "recipe") {
          setError(json?.error || "Could not load recipe");
          return;
        }
        setData(json as RecipePayload);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Network error");
      } finally {
        setLoading(false);
      }
    }
    run();
  }, [slug]);

  return (
    <main className="min-h-dvh bg-amber-50 text-stone-900">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <button
          onClick={() => router.back()}
          className="mb-4 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs hover:bg-stone-50"
        >
          ← Back
        </button>

        {loading && (
          <div className="rounded-xl border border-amber-200 bg-white p-4 text-sm">
            Loading…
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}
        {data && <RecipeView data={data} />}
      </div>
    </main>
  );
}

/* --- inline RecipeView (same UI you used on the home page) --- */
function RecipeView({ data }: { data: RecipePayload }) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
      <header className="mb-3">
        <h2 className="text-xl font-extrabold">{data.title}</h2>
        {(data.intro || data.time || data.servings) && (
          <div className="mt-1 text-sm text-stone-700">
            {data.intro && <p>{data.intro}</p>}
            {(data.time || data.servings) && (
              <p className="mt-1 text-stone-600">
                {data.servings ? `Servings: ${data.servings}` : ""}
                {data.servings && data.time ? " · " : ""}
                {data.time
                  ? `Time: ${
                      data.time?.total ??
                      [data.time?.prep, data.time?.cook]
                        .filter(Boolean)
                        .join(" + ")
                    }`
                  : ""}
              </p>
            )}
          </div>
        )}
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="mb-2 border-b border-stone-200 pb-1 text-base font-bold">
            Ingredients
          </h3>
          <div className="space-y-3">
            {data.ingredients.map((g, idx) => (
              <div key={idx}>
                {g.group && (
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
                    {g.group}
                  </div>
                )}
                <ul className="list-disc pl-5 text-sm">
                  {g.items.map((it, i) => (
                    <li key={i}>{it}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-2 border-b border-stone-200 pb-1 text-base font-bold">
            Directions
          </h3>
          <ol className="space-y-2 pl-5 text-sm">
            {data.steps.map((s, i) => (
              <li key={i} className="list-decimal">
                {s}
              </li>
            ))}
          </ol>

          {data.notes && data.notes.length > 0 && (
            <>
              <h4 className="mt-4 text-sm font-semibold">Notes</h4>
              <ul className="mt-1 list-disc pl-5 text-sm">
                {data.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
