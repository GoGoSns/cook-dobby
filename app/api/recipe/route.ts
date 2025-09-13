export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

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

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

// --- NEW: tiny retry helper ----------------------------------------------- 👈
async function fwFetchWithRetry(url: string, init: RequestInit, tries = 3) {
  let lastErr: string | undefined;
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, init);
    if (res.ok) return res;
    // retry on 429/5xx
    if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
      const wait = 300 * Math.pow(2, i); // 300ms, 600ms, 1200ms
      await new Promise((r) => setTimeout(r, wait));
      lastErr = await res.text();
      continue;
    }
    // non-retryable
    return res;
  }
  throw new Error(
    typeof lastErr === "string" ? lastErr : "Fireworks retry failed"
  );
}

// --- SYSTEM / HINTS --------------------------------------------------------
const SYSTEM = `
You are Cook Dobby. You ALWAYS return STRICT JSON (no markdown, no extra text).

Decide MODE from user's prompt:

1) "landing" when the user asks for ideas/options/plural.
   Return:
   {
     "mode":"landing",
     "intro":"2-4 inviting sentences",
     "sections":[
       {"title":"UPPERCASE name","teaser":"1-3 sentences","url":"/recipes/<slug>"}
     ]
   }
   2-8 sections max.

2) "recipe" for a single dish: when asked for a recipe, random recipe, or when they list ingredients.
   Ingredient rules:
   - If they list ingredients: treat those as the main available items.
   - If strict=true: DO NOT introduce new non-pantry ingredients.
   - Pantry allowed: water, salt, pepper, sugar, oil, butter, soy sauce, vinegar, flour, cornstarch, common herbs/spices in small amounts.
   - Fill "used_ingredients" from the user's text; put suggestions (not required) under "suggested_additions".
   Return object shape:
   {
     "mode":"recipe",
     "title":"Dish name",
     "servings": number (optional),
     "time":{"prep":"...","cook":"...","total":"..."} (optional),
     "intro":"1-2 sentences (optional)",
     "ingredients":[{"group":"optional","items":["..."]}],
     "steps":["Step 1...", "Step 2...", "..."],
     "notes":["optional"],
     "used_ingredients":["..."],
     "suggested_additions":["..."]
   }

Rules for both modes:
- JSON ONLY. No code fences. No commentary.
- Clear, numbered steps (each entry 1–2 sentences).
- URLs in landing should be "/recipes/<slugified-title>" if not provided.
`;

const JSON_HINT = `
Return ONLY a JSON object with one of these shapes:
{ "mode":"landing", "intro":"...", "sections":[{ "title":"...", "teaser":"...", "url":"..." }] }
OR
{ "mode":"recipe", "title":"...", "ingredients":[{"items":["..."]}], "steps":["..."] }
No markdown. No extra commentary.
`;

export async function POST(req: NextRequest) {
  try {
    // 👇 NEW: accept modelId + strict from the UI
    const { prompt, modelId, strict } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    const apiKey = process.env.FIREWORKS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing FIREWORKS_API_KEY" },
        { status: 500 }
      );
    }

    const defaultModel =
      process.env.FIREWORKS_MODEL ??
      "accounts/fireworks/models/llama-v3p1-8b-instruct";
    const model = modelId || defaultModel; // 👈 override per-request if provided

    const fwRes = await fwFetchWithRetry(
      "https://api.fireworks.ai/inference/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM },
            {
              role: "user",
              content:
                `User prompt: ${prompt}\n` +
                `strict=${Boolean(strict)}\n\n` +
                `IMPORTANT:\n${JSON_HINT}`,
            },
          ],
          temperature: 0.5,
          response_format: { type: "json_object" },
        }),
      }
    );

    if (!fwRes.ok) {
      const details = await fwRes.text();
      return NextResponse.json(
        { error: "Fireworks error", details },
        { status: 502 }
      );
    }

    const data = await fwRes.json();
    let raw = data?.choices?.[0]?.message?.content ?? "";

    const match = raw.match(/\{[\s\S]*\}$/);
    if (match) raw = match[0];

    let parsed: ApiResponse;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON from model", raw },
        { status: 502 }
      );
    }

    if (parsed.mode === "landing") {
      if (typeof parsed.intro !== "string" || !Array.isArray(parsed.sections)) {
        return NextResponse.json(
          { error: "Landing shape invalid", parsed },
          { status: 502 }
        );
      }
      parsed.sections = parsed.sections.slice(0, 8).map((s) => {
        const title = s.title.toUpperCase().trim();
        const url = s.url?.startsWith("/")
          ? s.url
          : `/recipes/${slugify(title)}`;
        return { title, teaser: s.teaser?.trim() ?? "", url };
      });
      return NextResponse.json(parsed);
    }

    if (parsed.mode === "recipe") {
      if (
        typeof parsed.title !== "string" ||
        !Array.isArray(parsed.ingredients) ||
        !Array.isArray(parsed.steps)
      ) {
        return NextResponse.json(
          { error: "Recipe shape invalid", parsed },
          { status: 502 }
        );
      }
      parsed.title = parsed.title.trim();
      parsed.ingredients = parsed.ingredients.map((g: IngredientGroup) => ({
        group: g.group ? String(g.group).trim() : undefined,
        items: Array.isArray(g.items)
          ? g.items.map((i: string) => String(i).trim()).filter(Boolean)
          : [],
      }));
      parsed.steps = parsed.steps
        .map((s: string) => String(s).trim())
        .filter(Boolean);
      if ((parsed as RecipePayload).intro)
        (parsed as RecipePayload).intro = String(
          (parsed as RecipePayload).intro
        ).trim();
      (parsed as RecipePayload).used_ingredients = (
        (parsed as RecipePayload).used_ingredients ?? []
      ).map((s: string) => String(s).trim());
      (parsed as RecipePayload).suggested_additions = (
        (parsed as RecipePayload).suggested_additions ?? []
      ).map((s: string) => String(s).trim());
      return NextResponse.json(parsed);
    }

    return NextResponse.json(
      { error: "Unknown mode", parsed },
      { status: 502 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
