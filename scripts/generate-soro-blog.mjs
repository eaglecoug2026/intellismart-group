import { mkdir, rm, writeFile } from "node:fs/promises";

const SITE_URL = "https://intellismartgroup.com";
const SITE_NAME = "Intellismart Group";
const EMBED_URL = "https://app.trysoro.com/api/embed/df2257b4-1ed5-4927-95b0-ca75a68f9e04";
const TOKEN = EMBED_URL.split("/").pop();
const API_BASE = "https://app.trysoro.com";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function isoDay(isoDate) {
  return String(isoDate || "").slice(0, 10);
}

function layout({ title, description, canonical, body, image, ogType = "website", jsonLd }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="${ogType}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${image || `${SITE_URL}/images/intellismart-og.png`}">
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css?v=20260924-blog-pages">
  ${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ""}
</head>
<body>
  <nav class="nav blog-nav">
    <a class="logo" href="/">${SITE_NAME}</a>
    <a class="back" href="/">Back to Home</a>
  </nav>
${body}
  <footer>© ${SITE_NAME}</footer>
</body>
</html>
`;
}

function blogIndex(articles) {
  const cards = articles.map((article) => `
        <a class="blog-card" href="/blog/${article.slug}/" itemscope itemtype="https://schema.org/BlogPosting">
          ${article.image ? `<img src="${article.image}" alt="${escapeHtml(article.title)}" loading="lazy" itemprop="image">` : ""}
          <span>
            <time datetime="${article.isoDate}" itemprop="datePublished">${escapeHtml(article.date)}</time>
            <strong itemprop="headline">${escapeHtml(article.title)}</strong>
            <em itemprop="description">${escapeHtml(article.excerpt)}</em>
          </span>
        </a>`).join("\n");

  return layout({
    title: `${SITE_NAME} Blog | AI Readiness & Automation`,
    description: "Practical guidance from Intellismart Group on AI readiness, automation, and putting AI to work in your business.",
    canonical: `${SITE_URL}/blog/`,
    body: `
  <main class="blog-main">
    <header class="blog-header">
      <div class="label">Insights</div>
      <h1>From the Blog</h1>
      <p>Practical guidance on AI readiness, automation, and putting AI to work in your business.</p>
    </header>

    <section class="blog-list" aria-label="${SITE_NAME} blog articles">
${cards}
    </section>
  </main>`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Blog",
      name: SITE_NAME,
      url: `${SITE_URL}/blog/`,
      blogPost: articles.map((article) => ({
        "@type": "BlogPosting",
        headline: article.title,
        description: article.excerpt,
        datePublished: article.isoDate,
        image: article.image || undefined,
        url: `${SITE_URL}/blog/${article.slug}/`,
      })),
    },
  });
}

function articlePage(article) {
  const canonical = `${SITE_URL}/blog/${article.slug}/`;
  return layout({
    title: `${article.title} | ${SITE_NAME}`,
    description: article.excerpt,
    canonical,
    ogType: "article",
    image: article.image,
    body: `
  <main class="blog-main">
    <article class="blog-article" itemscope itemtype="https://schema.org/BlogPosting">
      <a class="blog-back-link" href="/blog/">Back to blog</a>
      <header class="blog-article-header">
        <time datetime="${article.isoDate}" itemprop="datePublished">${escapeHtml(article.date)}</time>
        <h1 itemprop="headline">${escapeHtml(article.title)}</h1>
        <p itemprop="description">${escapeHtml(article.excerpt)}</p>
      </header>
      ${article.image ? `<img class="blog-article-image" src="${article.image}" alt="${escapeHtml(article.title)}" itemprop="image">` : ""}
      <div class="blog-article-content" itemprop="articleBody">
${article.content || ""}
      </div>
    </article>
  </main>`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: article.title,
      description: article.excerpt,
      datePublished: article.isoDate,
      image: article.image || undefined,
      url: canonical,
      publisher: {
        "@type": "Organization",
        name: SITE_NAME,
      },
    },
  });
}

function legacyBlogRedirect() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${SITE_NAME} Blog</title>
  <meta name="robots" content="noindex, follow">
  <meta http-equiv="refresh" content="0; url=/blog/">
  <link rel="canonical" href="${SITE_URL}/blog/">
</head>
<body>
  <p>The ${SITE_NAME} blog has moved to <a href="/blog/">/blog/</a>.</p>
</body>
</html>
`;
}

function sitemap(articles) {
  const articleUrls = articles.map((article) => `  <url>
    <loc>${SITE_URL}/blog/${article.slug}/</loc>
    <lastmod>${isoDay(article.isoDate)}</lastmod>
    <priority>0.6</priority>
  </url>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>2026-09-24</lastmod>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${SITE_URL}/blog/</loc>
    <lastmod>${isoDay(articles[0]?.isoDate) || "2026-09-24"}</lastmod>
    <priority>0.8</priority>
  </url>
${articleUrls}
</urlset>
`;
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.text();
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.json();
}

function parseArticles(embedScript) {
  const match = embedScript.match(/var SORO_ARTICLES = (\[[\s\S]*?\]);\n\s*var SORO_TOKEN/);
  if (!match) throw new Error("Could not find SORO_ARTICLES in embed script");
  return JSON.parse(match[1]);
}

const embedScript = await fetchText(EMBED_URL);
const rawArticles = parseArticles(embedScript);
const seenSlugs = new Set();
const articles = rawArticles.filter((article) => {
  if (seenSlugs.has(article.slug)) return false;
  seenSlugs.add(article.slug);
  return true;
});

for (const article of articles) {
  if (!article.content) {
    const detail = await fetchJson(`${API_BASE}/api/embed/${TOKEN}/article/${article.id}`);
    article.content = detail.content || "";
  }
}

await rm("blog", { recursive: true, force: true });
await mkdir("blog", { recursive: true });
await writeFile("blog/index.html", blogIndex(articles));
await writeFile("blog.html", legacyBlogRedirect());
await writeFile("sitemap.xml", sitemap(articles));

for (const article of articles) {
  await mkdir(`blog/${article.slug}`, { recursive: true });
  await writeFile(`blog/${article.slug}/index.html`, articlePage(article));
}

console.log(`Generated ${articles.length} blog article pages.`);
