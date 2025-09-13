"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

type LandingSection = { title: string; teaser: string; url: string };
type LandingPayload = {
  mode: "landing";
  intro: string;
  sections: LandingSection[];
};

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

type ApiResponse = LandingPayload | RecipePayload;

export default function Page() {
  const [prompt, setPrompt] = useState<string>("Give me a sushi recipe.");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);

  async function callAPI(p: string) {
    try {
      setLoading(true);
      setError(null);
      setData(null);
      const res = await fetch("/api/recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "Request failed");
        return;
      }
      setData(json as ApiResponse);
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("Network error");
      }
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    callAPI(prompt.trim());
  }

  function openRecipe(title: string) {
    // re-use the same endpoint to fetch a single recipe for a chosen idea
    const p = `Give me the full recipe for: ${title}`;
    callAPI(p);
  }

  return (
    <main className="relative isolate min-h-dvh text-stone-900">
      {/* Full-page background image */}
      <Image
        src="/images/bg.jpg"
        alt="Background"
        fill
        priority
        sizes="100vw"
        className="z-0 object-cover"
      />
      {/* Soft tint over the image (optional) */}
      <div className="relative z-10 mx-auto max-w-3xl px-4 py-10">
        {/* Header */}
        <div className="mb-8 text-center">
          {/* Dobby icon */}
          <Image
            src="/images/logo.gif"
            alt="Cook Dobby mascot"
            width={220}
            height={220}
            className="mx-auto"
            priority
          />
          <Image
            src="/images/logo2.jpg"
            alt="Cook Dobby wordmark"
            width={220}
            height={120}
            className="mx-auto -mt-2 h-auto w-auto"
            priority
          />

          <p className="mt-2 text-sm text-stone-700">
            Friendly recipe maker. Describe what you want—or list ingredients
            you have.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-amber-200 bg-white/80 p-4 shadow-sm backdrop-blur"
        >
          <label
            htmlFor="prompt"
            className="block text-sm font-medium text-stone-700"
          >
            Your request
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., I have salmon, avocado, cucumber, rice, and nori. Make me a roll."
            className="mt-2 h-28 w-full resize-y rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-amber-300"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-amber-600 disabled:opacity-50"
            >
              {loading ? "Cooking…" : "Generate"}
            </button>
            <button
              type="button"
              onClick={() => setPrompt("Give me a random sushi recipe.")}
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-700 hover:bg-stone-50"
            >
              Random sushi
            </button>
            <button
              type="button"
              onClick={() =>
                setPrompt(
                  "I have salmon, avocado, cucumber, sushi rice, and nori. Make me a roll."
                )
              }
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-700 hover:bg-stone-50"
            >
              Use my ingredients
            </button>
            <button
              type="button"
              onClick={() =>
                setPrompt("Show me a few sushi roll ideas I can try.")
              }
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-700 hover:bg-stone-50"
            >
              Ideas / options
            </button>
          </div>
        </form>

        {/* Errors */}
        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Results */}
        <div className="mt-6">
          {data?.mode === "landing" && (
            <LandingView data={data} onOpen={openRecipe} />
          )}
          {data?.mode === "recipe" && <RecipeView data={data} />}
        </div>
      </div>
    </main>
  );
}

/* ---------- Landing renderer ---------- */
function LandingView({
  data,
  onOpen,
}: {
  data: LandingPayload;
  onOpen: (title: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-extrabold">Ideas for you</h2>
      <p className="mt-1 text-sm text-stone-700">{data.intro}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {data.sections.map((s) => (
          <article
            key={s.title}
            className="flex flex-col rounded-xl border border-stone-200 bg-stone-50 p-4"
          >
            <h3 className="text-base font-extrabold tracking-wide">
              {s.title}
            </h3>
            <p className="mt-1 text-sm text-stone-700">{s.teaser}</p>

            <div className="mt-3 flex items-center gap-2">
              {/* Button that fetches a detailed recipe using the title */}
              <button
                onClick={() => onOpen(s.title)}
                className="rounded-lg bg-stone-900 px-3 py-2 text-xs font-semibold text-white hover:bg-stone-800"
              >
                GRAB THE RECIPE &gt;
              </button>

              <Link
                href={`/recipes/${slugify(s.title)}`}
                className="text-xs font-medium text-amber-700 underline underline-offset-2 hover:text-amber-800"
              >
                {`/recipes/${slugify(s.title)}`}
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ---------- Recipe renderer ---------- */
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

          {data.used_ingredients && data.used_ingredients.length > 0 && (
            <p className="mt-3 text-xs text-stone-500">
              Used from your list: {data.used_ingredients.join(", ")}
            </p>
          )}
          {data.suggested_additions && data.suggested_additions.length > 0 && (
            <p className="mt-1 text-xs text-stone-500">
              Optional additions: {data.suggested_additions.join(", ")}
            </p>
          )}
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
