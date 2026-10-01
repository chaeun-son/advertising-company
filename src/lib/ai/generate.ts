import { createServerFn } from "@tanstack/react-start";
import { closestAspectRatio } from "@/lib/studio/catalog";
import type { AiDirection, Brief, Palette, TextZone } from "@/lib/studio/types";

type VisualStyle = "auto" | "photo" | "type" | "illustration" | "public" | "backdrop";

type PlanInput = {
  brief: Pick<
    Brief,
    | "industry"
    | "purpose"
    | "mood"
    | "emphasize"
    | "name"
    | "headline"
    | "subhead"
    | "price"
    | "date"
    | "place"
    | "phone"
    | "notes"
    | "baseColor"
    | "accentColor"
  >;
  width: number;
  height: number;
  includeText: boolean;
  visualStyle: VisualStyle;
};

type RenderInput = {
  prompt: string;
  width: number;
  height: number;
  quality: "fast" | "print";
};

type RefineInput = {
  image: string;
  instruction: string;
  width: number;
  height: number;
  quality: "fast" | "print";
};

type SuggestInput = {
  industry: string;
  purpose: string;
  name: string;
  headline: string;
};

type OrderAiInput = {
  source: string;
};

type OrderAiItem = {
  kind: "banner" | "zoom" | "web" | "card" | "flyer" | "sticker" | "custom";
  label: string;
  widthMm: number | null;
  heightMm: number | null;
  quantity: number;
  sizeText: string;
};

type OrderAiResult = {
  name: string;
  headline: string;
  subhead: string;
  items: OrderAiItem[];
  missing: string[];
};

const INDUSTRY_KO: Record<string, string> = {
  food: "음식점·카페",
  shop: "매장·세일",
  realty: "부동산·분양",
  academy: "학원·교육",
  church: "교회·종교",
  hospital: "병원·약국",
  construction: "공사·안전",
  beauty: "미용·웨딩",
  auto: "자동차·정비",
  event: "행사·축제",
  recruit: "구인·모집",
  general: "일반 광고",
};

const MOOD_KO: Record<string, string> = {
  bold: "강렬하고 대비가 큰",
  urgent: "급하고 주목도 높은",
  luxury: "고급스럽고 절제된",
  solemn: "경건하고 단정한",
  warm: "따뜻하고 정감 있는",
  friendly: "친근하고 밝은",
  restrained: "여백이 있는 절제된",
};

function apiKey() {
  return process.env.OPENAI_API_KEY?.trim() || process.env.XAI_API_KEY?.trim() || "";
}

function isOpenAi() { return Boolean(process.env.OPENAI_API_KEY?.trim()); }

function apiError(status: number, raw: string, action: string) {
  let detail = raw.slice(0, 300);
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string; code?: string } };
    detail = parsed.error?.message || parsed.error?.code || detail;
  } catch { /* plain-text error */ }
  const hint = status === 401
    ? "API 키가 올바른지 확인해 주세요."
    : status === 403
      ? "프로젝트 권한 또는 조직 인증 상태를 확인해 주세요."
      : status === 429
        ? "API 결제 잔액·사용 한도 또는 잠시 후 재시도를 확인해 주세요."
        : status === 400
          ? "요청 모델과 프로젝트 사용 권한을 확인해 주세요."
          : "잠시 후 다시 시도해 주세요.";
  return new Error(`${action} 실패 (${status}). ${hint}${detail ? ` · ${detail}` : ""}`);
}

export const getAiStatus = createServerFn({ method: "POST" }).handler(async () => {
  return { available: Boolean(apiKey()) };
});

async function chatJson(prompt: string): Promise<unknown> {
  const key = apiKey();
  const openai = isOpenAi();
  const res = await fetch(openai ? "https://api.openai.com/v1/chat/completions" : "https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: openai ? "gpt-4.1-mini" : "grok-4.5",
      temperature: 0.7,
      max_tokens: 1400,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an art director for Korean print ads (banners, business cards, flyers). Reply with JSON only.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw apiError(res.status, await res.text().catch(() => ""), "AI 기획");
  const body = (await res.json()) as { choices: { message: { content: string } }[] };
  const text = body.choices[0]?.message.content ?? "{}";
  const cleaned = text.replace(/^```json\s*|\s*```$/g, "");
  return JSON.parse(cleaned) as unknown;
}

async function imagine(prompt: string, aspect: string, quality: "fast" | "print"): Promise<string> {
  const key = apiKey();
  if (isOpenAi()) {
    const wide = ["16:9", "21:9", "5:2", "20:9", "3:2", "4:3"].includes(aspect);
    const size = wide ? "1536x1024" : aspect === "1:1" ? "1024x1024" : "1024x1536";
    const model = quality === "print" ? "gpt-image-2.5-sunburst" : "gpt-image-2.5-flare";
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, prompt, n: 1, size, quality: quality === "print" ? "high" : "low" }),
    });
    if (!res.ok) throw apiError(res.status, await res.text().catch(() => ""), "이미지 생성");
    const body = await res.json() as { data?: { b64_json?: string }[] };
    if (!body.data?.[0]?.b64_json) throw new Error("이미지 응답이 비었습니다.");
    return `data:image/png;base64,${body.data[0].b64_json}`;
  }
  const res = await fetch("https://api.x.ai/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "grok-imagine-image-2.0",
      prompt,
      n: 1,
      aspect_ratio: aspect,
      resolution: quality === "print" ? "2k" : "1k",
      quality: quality === "print" ? "medium" : "low",
      response_format: "url",
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`이미지 생성 실패 (${res.status}) ${errText.slice(0, 180)}`);
  }
  const body = (await res.json()) as { data: { b64_json?: string; url?: string }[] };
  const item = body.data?.[0];
  const src = item?.url ?? (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : "");
  if (!src) throw new Error("이미지 응답이 비었습니다");
  return await toDataUrl(src);
}

async function imagineEdit(image: string, prompt: string, aspect: string, quality: "fast" | "print"): Promise<string> {
  const key = apiKey();
  if (isOpenAi()) {
    const parts = image.match(/^data:([^;]+);base64,(.*)$/);
    if (!parts) throw new Error("편집할 이미지를 다시 불러와 주세요.");
    const form = new FormData();
    form.append("model", quality === "print" ? "gpt-image-2.5-sunburst" : "gpt-image-2.5-flare");
    form.append("prompt", prompt);
    form.append("quality", quality === "print" ? "high" : "low");
    form.append("size", ["16:9", "21:9", "5:2", "20:9", "3:2", "4:3"].includes(aspect) ? "1536x1024" : "1024x1024");
    form.append("image", new Blob([Buffer.from(parts[2], "base64")], { type: parts[1] }), "background.png");
    const res = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
    if (!res.ok) throw apiError(res.status, await res.text().catch(() => ""), "이미지 수정");
    const body = await res.json() as { data?: { b64_json?: string }[] };
    if (!body.data?.[0]?.b64_json) throw new Error("수정 이미지 응답이 비었습니다.");
    return `data:image/png;base64,${body.data[0].b64_json}`;
  }
  const res = await fetch("https://api.x.ai/v1/images/edits", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "grok-imagine-image-2.0",
      prompt,
      image: { url: image, type: "image_url" },
      aspect_ratio: aspect,
      resolution: quality === "print" ? "2k" : "1k",
      quality: quality === "print" ? "medium" : "low",
      response_format: "url",
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`이미지 수정 실패 (${res.status}) ${errText.slice(0, 180)}`);
  }
  const body = (await res.json()) as { data: { b64_json?: string; url?: string }[] };
  const item = body.data?.[0];
  const src = item?.url ?? (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : "");
  if (!src) throw new Error("이미지 응답이 비었습니다");
  return await toDataUrl(src);
}

async function toDataUrl(src: string): Promise<string> {
  if (src.startsWith("data:")) return src;
  try {
    const res = await fetch(src);
    if (!res.ok) return src;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 3_200_000) return src;
    const mime = res.headers.get("content-type") || "image/jpeg";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return src;
  }
}


function semanticThemeLock(brief: PlanInput["brief"]) {
  const source = `${brief.headline} ${brief.subhead} ${brief.notes}`.toLowerCase();
  const rules: string[] = [];

  if (/(부활절|부활|예수|교회|easter)/i.test(source)) {
    rules.push(
      'RELIGIOUS THEME LOCK: This is a Christian Easter/resurrection design. Use unmistakable Easter/resurrection cues such as a radiant cross, empty tomb at dawn, sunrise light, lilies, subtle church architecture, or worshipful light. Do NOT use a generic flower garden, random countryside, classroom, or unrelated lifestyle imagery. Avoid Easter bunny/egg imagery unless the order explicitly asks for a children-oriented Easter style.'
    );
  }
  if (/(성탄|크리스마스|christmas|예수님 탄생)/i.test(source)) {
    rules.push(
      'CHRISTMAS THEME LOCK: Use unmistakable Christian Christmas cues such as Bethlehem star, nativity-inspired silhouettes, candlelight, church windows, restrained festive greenery, or warm sacred night lighting. Do NOT substitute generic winter scenery unless it clearly supports the Christmas theme.'
    );
  }
  if (/(체육대회|운동회|sports day|체육 행사)/i.test(source)) {
    rules.push(
      'SPORTS EVENT THEME LOCK: Show clear sports-day/event energy such as track field, team ribbons, cheering groups, athletic motion, flags, or stadium cues. Avoid unrelated scenic landscapes.'
    );
  }
  if (/(봉사활동|자원봉사|volunteer)/i.test(source)) {
    rules.push(
      'VOLUNTEER THEME LOCK: Show recognizable community service/helping-hands activity, teamwork, home repair/support, donation or caring interaction appropriate to the order. Avoid generic stock portraits that do not communicate volunteering.'
    );
  }
  if (/(교사교육|연수|교육|세미나|워크숍|강의)/i.test(source)) {
    rules.push(
      'EDUCATION THEME LOCK: Show a professional education/training context with educators, workshop materials, seminar environment, learning collaboration, or education-themed abstract graphics. Avoid unrelated travel or landscape imagery.'
    );
  }

  return rules.join(' ');
}

function fallbackDirections(input: PlanInput): AiDirection[] {
  const ind = INDUSTRY_KO[input.brief.industry] ?? "광고";
  const semanticLock = semanticThemeLock(input.brief);
  const mood = MOOD_KO[input.brief.mood] ?? "단정한";
  const noText =
    "Absolutely no text, no letters, no Hangul, no numbers, no logos, no watermarks, no captions. Leave clear empty space for later typography overlay.";
  const styleHint: Record<VisualStyle, string> = {
    auto: "Choose the strongest visual language for the product, not necessarily photography.",
    photo: "Use refined commercial photography with realistic depth and lighting.",
    type: "Use a graphic design background: bold color fields, geometric shapes, clean negative space, no photographic subject.",
    illustration: "Use tasteful editorial illustration, soft vector-like shapes, friendly but professional, no photorealism.",
    public: "Use a clean Korean public-institution event design: restrained geometry, clear grid, formal and trustworthy, minimal imagery.",
    backdrop: "Design a stage/Zoom backdrop, not a poster: full-canvas visual, keep the center visually open, place decoration toward the edges and corners, no central card or panel.",
  };
  const selectedStyle = styleHint[input.visualStyle] || styleHint.auto;
  const scenes = [
    {
      letter: "A" as const,
      title: "현장 사진 · 왼쪽 글자",
      textZone: "left" as TextZone,
      scene: `${selectedStyle} Korean ${ind} advertising composition. ${mood} mood. The visual subject MUST directly represent this current order theme: "${input.brief.headline}". ${semanticLock} Supporting order context: "${input.brief.subhead}" / "${input.brief.notes}". Do not substitute generic unrelated scenery. Strong hierarchy and print-ready composition.`,
      pal: {
        bg: input.brief.baseColor || "#1c1917",
        panel: "#111111",
        text: "#f8f5f0",
        muted: "#d6d3d1",
        accent: input.brief.accentColor || "#ea580c",
        onAccent: "#fff7ed",
      },
    },
    {
      letter: "B" as const,
      title: "여백 · 하단 글자",
      textZone: "bottom" as TextZone,
      scene: `${selectedStyle} Alternative Korean ${ind} composition. ${mood} palette. The visual subject MUST clearly and recognizably match the current order theme: "${input.brief.headline}". ${semanticLock} with supporting context "${input.brief.subhead}" / "${input.brief.notes}". No unrelated generic landscape or stock-like scene. Generous negative space, elegant editorial balance.`,
      pal: {
        bg: "#0f172a",
        panel: "#1e293b",
        text: "#f8fafc",
        muted: "#cbd5e1",
        accent: "#38bdf8",
        onAccent: "#0f172a",
      },
    },
    {
      letter: "C" as const,
      title: "클로즈업 · 오른쪽 글자",
      textZone: "right" as TextZone,
      scene: `${selectedStyle} Third distinct Korean ${ind} composition. ${mood} mood. The artwork MUST visually communicate the exact current order topic: "${input.brief.headline}". ${semanticLock} using recognizable subject matter supported by "${input.brief.subhead}" / "${input.brief.notes}". Reject unrelated generic imagery. Asymmetric balance, open typography area, visually different from A and B.`,
      pal: {
        bg: "#14532d",
        panel: "#166534",
        text: "#f0fdf4",
        muted: "#bbf7d0",
        accent: "#86efac",
        onAccent: "#14532d",
      },
    },
  ];
  return scenes.map((s) => ({
    letter: s.letter,
    title: s.title,
    textZone: s.textZone,
    palette: s.pal,
    prompt: `${s.scene} ${noText} High-end Korean advertising design, print-ready, crisp edges, polished composition, 4k detail.`,
  }));
}

function parseDirections(raw: unknown, fallback: AiDirection[]): AiDirection[] {
  if (!raw || typeof raw !== "object") return fallback;
  const dirs = (raw as { directions?: unknown }).directions;
  if (!Array.isArray(dirs) || dirs.length < 1) return fallback;
  const letters: Array<"A" | "B" | "C"> = ["A", "B", "C"];
  const zones: TextZone[] = ["left", "right", "top", "bottom", "center"];
  return letters.map((letter, i) => {
    const d = (dirs[i] ?? dirs[0] ?? {}) as Record<string, unknown>;
    const pal = (d.palette ?? {}) as Record<string, unknown>;
    const zone = zones.includes(d.textZone as TextZone) ? (d.textZone as TextZone) : fallback[i].textZone;
    const palette: Palette = {
      bg: String(pal.bg || fallback[i].palette.bg),
      panel: String(pal.panel || fallback[i].palette.panel),
      text: String(pal.text || fallback[i].palette.text),
      muted: String(pal.muted || fallback[i].palette.muted),
      accent: String(pal.accent || fallback[i].palette.accent),
      onAccent: String(pal.onAccent || fallback[i].palette.onAccent),
    };
    return {
      letter,
      title: String(d.title || fallback[i].title).slice(0, 24),
      textZone: zone,
      palette,
      prompt: String(d.prompt || fallback[i].prompt),
    };
  });
}

export const planAiDirections = createServerFn({ method: "POST" })
  .validator((input: PlanInput) => input)
  .handler(async ({ data }) => {
    const key = apiKey();
    if (!key) return { ok: false as const, error: "AI 기능을 이 환경에서 쓸 수 없습니다." };
    const fallback = fallbackDirections(data);
    try {
      const industry = INDUSTRY_KO[data.brief.industry] ?? data.brief.industry;
      const mood = MOOD_KO[data.brief.mood] ?? data.brief.mood;
      const semanticLock = semanticThemeLock(data.brief);
      const aspectRatio = data.width / Math.max(1, data.height);
      const wideBannerRule = aspectRatio >= 3
        ? `EXTREME-WIDE BANNER RULE: The final print ratio is ${data.width}:${data.height}. Compose the source art so it can be extended horizontally without visible seams. Keep ALL important subjects, faces, hands, crosses, buildings, logos, or symbolic objects inside the central 50-55% of the image. Keep the far-left and far-right 25% low-detail and extendable using only sky, light, color gradients, soft texture, foliage edges, or abstract atmosphere. Never place a critical subject at either outer edge. Leave calm side space suitable for typography.`
        : "Keep critical subjects comfortably inside the safe center and leave usable negative space for typography.";
      const textRule = data.includeText
        ? `Render the Korean copy exactly as given, sharp Hangul, no extra words: 상호 "${data.brief.name}", 메인 "${data.brief.headline}". ${data.brief.subhead ? `보조 "${data.brief.subhead}".` : ""} ${data.brief.phone ? `전화 ${data.brief.phone}.` : ""}`
        : "BACKGROUND ART ONLY. Absolutely no visible text of any kind: no letters, no Hangul, no numbers, no signs, no logos, no labels, no watermarks, no typography-like marks. Do not render mock text. Leave clean negative space for typography that will be added separately by the editor.";
      const raw = await chatJson(`Korean print ad art direction. Industry: ${industry}. Mood: ${mood}.
CURRENT ORDER ONLY (ignore any prior project context and do not carry over any previous subject):
headline=${data.brief.headline}
sub=${data.brief.subhead}
order=${data.brief.notes}

CRITICAL THEME-FIDELITY RULES:
- The artwork must visibly and recognizably match the exact subject of the CURRENT ORDER. Theme fidelity is more important than generic beauty.
- Identify the order's concrete theme, event, season, audience, or purpose and use visual symbols/subjects that directly communicate it.
- Do NOT replace the requested subject with an unrelated pretty landscape, generic garden, generic classroom, generic people, or stock-photo scene unless that subject is explicitly relevant to the order.
- If the order is for a named holiday/event (for example Easter, Christmas, sports day, volunteer event, education event), every direction must contain recognizable visual cues for that exact event while still being tasteful and commercially usable.
- Keep the three directions different in art style/layout, but all three must clearly belong to the SAME requested theme.
- Do not invent a different event, audience, organization, or message.
- ${semanticLock || "Use concrete, recognizable visual cues taken directly from the order topic. Avoid vague generic scenery."}
- ${wideBannerRule}

Brand colors: ${data.brief.baseColor} / ${data.brief.accentColor}.
Canvas ${data.width}×${data.height}.
Requested visual style=${data.visualStyle}. Treat this as a hard art-direction preference. If style is type, avoid photography. If illustration, avoid photorealism. If public, use formal institutional design. If backdrop, keep center open and never create a large central card/panel.
Return JSON: {"directions":[{ "title": "short Korean name", "textZone": "left|right|top|bottom|center", "palette": {"bg":"#","panel":"#","text":"#","muted":"#","accent":"#","onAccent":"#"}, "prompt": "English visual prompt, 3-5 sentences. Explicitly state the exact visual subject/theme and recognizable theme cues. ${textRule}" }, x3 ]}
Make the three directions visually distinct, but theme-identical to the current order. Prompts must be in English. Titles in Korean.`);
      let directions = parseDirections(raw, fallback);
      const orderGrounding = `THEME LOCK: This image is for the current Korean advertising order only. Exact theme/headline: "${data.brief.headline}". Supporting context: "${data.brief.subhead}". Full order context: "${data.brief.notes}". The visible imagery must clearly communicate this exact theme. Do not use unrelated generic scenery or substitute a different event/audience. ${semanticLock} ${wideBannerRule}`;
      directions = directions.map((d) => ({ ...d, prompt: `${orderGrounding} ${d.prompt}` }));
      if (!data.includeText) {
        directions = directions.map((d) => ({
          ...d,
          prompt: `${d.prompt} BACKGROUND ART ONLY. Absolutely no visible text, letters, Hangul, numbers, signs, logos, labels, watermarks, or fake typography. Do not place any words inside the image.`,
        }));
      }
      return { ok: true as const, directions };
    } catch {
      return { ok: true as const, directions: fallback };
    }
  });

export const renderAiImage = createServerFn({ method: "POST" })
  .validator((input: RenderInput) => input)
  .handler(async ({ data }) => {
    const key = apiKey();
    if (!key) return { ok: false as const, error: "AI 기능을 이 환경에서 쓸 수 없습니다." };
    try {
      const aspect = closestAspectRatio(data.width, data.height);
      const image = await imagine(data.prompt, aspect, data.quality);
      return { ok: true as const, image };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : "생성 실패" };
    }
  });

export const refineAiImage = createServerFn({ method: "POST" })
  .validator((input: RefineInput) => input)
  .handler(async ({ data }) => {
    const key = apiKey();
    if (!key) return { ok: false as const, error: "AI 기능을 이 환경에서 쓸 수 없습니다." };
    try {
      const aspect = closestAspectRatio(data.width, data.height);
      const prompt = `${data.instruction}. Keep composition usable as a Korean print-ad background. Do not add new text, letters, Hangul, numbers, logos or watermarks.`;
      const image = await imagineEdit(data.image, prompt, aspect, data.quality);
      return { ok: true as const, image };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : "수정 실패" };
    }
  });

export const suggestCopy = createServerFn({ method: "POST" })
  .validator((input: SuggestInput) => input)
  .handler(async ({ data }) => {
    const key = apiKey();
    if (!key) return { ok: false as const, error: "AI 기능을 이 환경에서 쓸 수 없습니다." };
    try {
      const raw = await chatJson(`한국어 광고 카피 제안. 업종=${data.industry} 목적=${data.purpose} 상호=${data.name} 현재 메인=${data.headline}.
지어내지 말고, 상호는 바꾸지 마세요. 메인 문구가 비어 있으면 업종에 맞는 짧은 헤드라인 3개만.
JSON: {"headlines":["...","...","..."], "subheads":["...","..."], "tone":"한 줄 조언"}`);
      const obj = (raw ?? {}) as { headlines?: string[]; subheads?: string[]; tone?: string };
      return {
        ok: true as const,
        headlines: (obj.headlines ?? []).slice(0, 3).map(String),
        subheads: (obj.subheads ?? []).slice(0, 3).map(String),
        tone: String(obj.tone ?? ""),
      };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : "제안 실패" };
    }
  });


export const analyzeOrderContent = createServerFn({ method: "POST" })
  .validator((input: OrderAiInput) => input)
  .handler(async ({ data }) => {
    const key = apiKey();
    if (!key) return { ok: false as const, error: "AI 기능을 이 환경에서 쓸 수 없습니다." };
    const source = data.source.trim();
    if (!source) return { ok: false as const, error: "주문내용이 비어 있습니다." };
    try {
      const raw = await chatJson(`당신은 한국 광고사에서 고객 주문을 실제 제작용 작업지시로 정리하는 디자이너입니다.
아래 주문 원문만 근거로 분석하세요. 없는 내용을 절대 지어내지 마세요.

[주문 원문]
${source}

목표:
1) 현수막/배너/명함/리플렛 등 품목과 규격·수량을 찾아냅니다.
2) 디자인에 들어갈 문구를 의미 기준으로 정리합니다. 첫 문장을 무조건 제목으로 쓰지 마세요.
3) 규격, 수량, 납품 요청, 제작 지시는 광고 문구와 분리하세요.
4) 고객이 쓴 행사명·기관명·핵심 문구는 임의로 합치거나 새로운 단어를 만들지 마세요. 띄어쓰기는 자연스럽게 정리할 수 있습니다.
5) name은 교회명·기관명·학교명·업체명 같은 주최/의뢰 기관입니다. 기관명을 headline으로 올리지 말고 name에 분리하세요.
6) headline은 고객이 강조해 달라고 한 표어·행사명·핵심 메시지입니다. 현수막에서 가장 크게 보여야 할 문구를 원문 그대로 고르세요. 고객 주문에 표어와 기관명이 함께 있으면 반드시 표어를 headline, 기관명을 name으로 분리하세요.
7) subhead는 핵심 문구 다음으로 보여야 할 보조 문구입니다. 주문에 실제 보조 문구가 없으면 빈 문자열로 두세요.
8) 날짜·장소·연락처가 고객 문구의 일부로 꼭 보여야 한다고 판단될 때만 subhead에 자연스럽게 포함하세요.
9) 주문에 서로 다른 광고물이 여러 개면 items에 각각 분리하세요.
10) mm/cm/m 단위는 widthMm/heightMm를 mm로 환산하세요.
11) 고객이 단위를 생략하고 "150x120", "500x90"처럼 적었는데 품목이 현수막/줌배경/포토월/배경막 같은 출력물이라면 기본적으로 cm로 해석하세요. 예: 150x120 -> 1500x1200mm.
12) "줌배경", "포토월", "포토존", "백월", "배경막"은 kind를 "zoom"으로 분류하세요.

분석 예시:
원문: "말씀으로 새롭게, 성령으로 뜨겁게, 서로 사랑하라 / 400x90 현수막 / 전주그리스도의교회"
결과: name="전주그리스도의교회", headline="말씀으로 새롭게, 성령으로 뜨겁게, 서로 사랑하라", subhead=""

JSON만 반환:
{
  "name":"...",
  "headline":"...",
  "subhead":"...",
  "items":[{"kind":"banner|zoom|web|card|flyer|sticker|custom","label":"현수막","widthMm":4000,"heightMm":900,"quantity":1,"sizeText":"4000×900mm"}],
  "missing":["규격"]
}`);
      const obj = (raw ?? {}) as Partial<OrderAiResult>;
      const items = Array.isArray(obj.items) ? obj.items.slice(0, 12).map((item) => ({
        kind: ["banner","zoom","web","card","flyer","sticker","custom"].includes(String(item.kind)) ? item.kind : "custom",
        label: String(item.label || "광고물").slice(0, 24),
        widthMm: Number.isFinite(Number(item.widthMm)) && Number(item.widthMm) > 0 ? Math.round(Number(item.widthMm)) : null,
        heightMm: Number.isFinite(Number(item.heightMm)) && Number(item.heightMm) > 0 ? Math.round(Number(item.heightMm)) : null,
        quantity: Number.isFinite(Number(item.quantity)) && Number(item.quantity) > 0 ? Math.round(Number(item.quantity)) : 1,
        sizeText: String(item.sizeText || "규격 확인 필요").slice(0, 48),
      })) as OrderAiItem[] : [];
      return {
        ok: true as const,
        analysis: {
          name: String(obj.name || "").trim().slice(0, 60),
          headline: String(obj.headline || "").trim().slice(0, 60),
          subhead: String(obj.subhead || "").trim().slice(0, 100),
          items,
          missing: Array.isArray(obj.missing) ? obj.missing.slice(0, 8).map(String) : [],
        } satisfies OrderAiResult,
      };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : "주문 분석 실패" };
    }
  });
