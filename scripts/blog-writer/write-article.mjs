// Writes one new blog article with Claude and saves it to
// blog-content/articles/<slug>.json, where scripts/generate-blog.mjs picks it up.
//
// Topic: the TOPIC env var if set, else the first line of blog-content/topics.md
// (which is then removed), else Claude picks a new topic that doesn't repeat an
// existing article. The site's audience, voice and rules live in
// blog-content/brief.md.
//
// Keyword: each article aims at one search phrase from blog-content/keywords.md,
// the first one no article has used yet (with a queued topic, the unused one
// that fits it best). Once every keyword is used, they come round again.
//
// Picture: cover-image.mjs draws a cover in the style of
// blog-content/image-style.md when OPENAI_API_KEY is set.
//
// Run from the site root: node scripts/blog-writer/write-article.mjs
// Prints slug=... and title=... lines for $GITHUB_OUTPUT.
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { makeCover } from "./cover-image.mjs";

const ARTICLES_DIR = "blog-content/articles";
const BRIEF_FILE = "blog-content/brief.md";
const TOPICS_FILE = "blog-content/topics.md";
const KEYWORDS_FILE = "blog-content/keywords.md";

const ARTICLE_RULES = `Article rules:
- 1,200 to 1,800 words, organized with h2 and h3 headings.
- Don't invent statistics, studies, quotes, client names or customer stories. If you give a number, make it a clearly labeled example or a common rule of thumb.
- No filler intro; open with the reader's problem.
- content_html uses only <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <a>, <table>, <thead>, <tbody>, <tr>, <th>, <td>. No <h1>, no images, no inline styles.
- Don't repeat or closely overlap any existing article listed below.`;

const KEYWORD_RULES = `Target keyword rules:
- Use the target keyword word for word in the title, in the first paragraph, in at least one h2, and in the excerpt.
- Use it a few more times in the body where it reads naturally. Never stuff it or bend a sentence around it; close variations are fine.`;

const Article = z.object({
  topic: z.string().describe("The topic this article covers, one line"),
  keyword: z.string().describe("The target keyword the article aims at, copied exactly from the list given"),
  title: z.string().describe("Headline, under 65 characters"),
  slug: z.string().describe("lowercase-words-joined-by-hyphens, 3 to 7 words"),
  excerpt: z.string().describe("Meta description, 140 to 160 characters"),
  content_html: z.string(),
  image_scene: z.string().describe("One or two sentences describing the cover picture: the people, objects and setting that show this article's subject. Nothing with readable text, logos or brand names."),
});

async function readText(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}

async function existingArticles() {
  await mkdir(ARTICLES_DIR, { recursive: true });
  const files = (await readdir(ARTICLES_DIR)).filter((f) => f.endsWith(".json"));
  return Promise.all(files.map(async (f) => JSON.parse(await readFile(`${ARTICLES_DIR}/${f}`, "utf8"))));
}

function cleanSlug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

const brief = (await readText(BRIEF_FILE)).trim();
if (!brief) throw new Error(`${BRIEF_FILE} is missing`);

const articles = await existingArticles();
const titles = articles.map((a) => `- ${a.title}`).join("\n") || "(none yet)";

const queue = (await readText(TOPICS_FILE)).split("\n").map((l) => l.replace(/^[-*]\s*/, "").trim());
const queuedIndex = queue.findIndex((l) => l && !l.startsWith("#"));
const topic = process.env.TOPIC?.trim() || (queuedIndex >= 0 ? queue[queuedIndex] : "");

const keywordList = (await readText(KEYWORDS_FILE)).split("\n")
  .map((l) => l.replace(/^[-*]\s*/, "").trim())
  .filter((l) => l && !l.startsWith("#"));
const usedKeywords = new Set(articles.map((a) => a.keyword?.toLowerCase()).filter(Boolean));
const unusedKeywords = keywordList.filter((k) => !usedKeywords.has(k.toLowerCase()));
const openKeywords = unusedKeywords.length ? unusedKeywords : keywordList;
const keywordLines = openKeywords.map((k) => `- ${k}`).join("\n");

let ask;
if (topic && openKeywords.length) {
  ask = `Write the article for this topic: ${topic}\n\nPick the target keyword from this list that fits the topic best:\n${keywordLines}`;
} else if (topic) {
  ask = `Write the article for this topic: ${topic}\n\nUse the search phrase a reader would type to find it as the target keyword.`;
} else if (openKeywords.length) {
  ask = `Target keyword: ${openKeywords[0]}\n\nChoose a topic built around that keyword that no existing article covers, then write the article.`;
} else {
  ask = "Choose a new topic that this site's readers search for and that no existing article covers, use the search phrase a reader would type to find it as the target keyword, then write the article.";
}

const client = new Anthropic();
const response = await client.messages.parse({
  model: "claude-opus-5-5",
  max_tokens: 16000,
  output_config: { effort: "high", format: zodOutputFormat(Article) },
  system: `${brief}\n\n${ARTICLE_RULES}\n\n${KEYWORD_RULES}\n\nExisting articles on this site:\n${titles}`,
  messages: [{ role: "user", content: ask }],
});

if (response.stop_reason !== "end_turn" || !response.parsed_output) {
  throw new Error(`Writer stopped with ${response.stop_reason}`);
}

const out = response.parsed_output;
const taken = new Set(articles.map((a) => a.slug));
let slug = cleanSlug(out.slug || out.title);
for (let n = 2; taken.has(slug); n += 1) slug = `${cleanSlug(out.slug || out.title)}-${n}`;

const now = new Date();
const article = {
  id: slug,
  slug,
  title: out.title,
  excerpt: out.excerpt,
  date: now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" }),
  isoDate: now.toISOString(),
  image: await makeCover(slug, out.image_scene),
  content: out.content_html,
  topic: out.topic,
  keyword: out.keyword,
  source: "writer",
};

await writeFile(`${ARTICLES_DIR}/${slug}.json`, `${JSON.stringify(article, null, 2)}\n`);

if (!process.env.TOPIC?.trim() && queuedIndex >= 0) {
  const lines = (await readText(TOPICS_FILE)).split("\n");
  const lineIndex = lines.findIndex((l) => l.replace(/^[-*]\s*/, "").trim() === topic);
  lines.splice(lineIndex, 1);
  await writeFile(TOPICS_FILE, lines.join("\n"));
}

const words = out.content_html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
if (keywordList.length && !keywordList.some((k) => k.toLowerCase() === out.keyword.toLowerCase())) {
  console.error(`Warning: keyword "${out.keyword}" isn't in ${KEYWORDS_FILE}`);
}
console.error(`Wrote "${article.title}" for "${out.keyword}" (${words} words, ${response.usage.output_tokens} output tokens)`);
console.log(`slug=${slug}`);
console.log(`title=${article.title.replace(/\n/g, " ")}`);
console.log(`words=${words}`);
console.log(`keyword=${out.keyword.replace(/\n/g, " ")}`);
console.log(`picture=${article.image ? "yes" : "no"}`);
