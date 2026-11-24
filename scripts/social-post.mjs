#!/usr/bin/env node
// Posts one published blog article to this brand's Facebook Page and to the
// Instagram account linked to it. Run from the repo root once the article is
// live:
//
//   node scripts/social-post.mjs <slug>
//
// It reads the article from blog-content/articles/<slug>.json, waits for the
// article's jpg cover picture to be reachable on the live site (Instagram
// fetches the picture itself, so it has to be public first), writes a short
// caption with Claude, then posts the picture and caption to the Page and to
// Instagram.
//
// What it needs in the environment:
//   SITE_URL           the live site, e.g. https://intellismartgroup.com
//   FB_PAGE_ID         the Facebook Page's id
//   FB_PAGE_TOKEN      a Page access token carrying pages_manage_posts,
//                      instagram_basic and instagram_content_publish
//   IG_USER_ID         the Instagram business account id linked to that Page
//   ANTHROPIC_API_KEY  writes the caption; without it a plain one is used
//
// With FB_PAGE_ID, FB_PAGE_TOKEN and IG_USER_ID missing it prints the captions
// and stops, so the captions can be checked without posting anything.

import { readFile } from "node:fs/promises";

const GRAPH = "https://graph.facebook.com/v27.0";
const ARTICLES_DIR = "blog-content/articles";
const BRIEF_FILE = "blog-content/brief.md";
const CAPTION_MODEL = "claude-sonnet-5-5";

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: node scripts/social-post.mjs <slug>");
  process.exit(2);
}

const SITE_URL = (process.env.SITE_URL || "").replace(/\/+$/, "");
if (!SITE_URL) {
  console.error("No SITE_URL, so there is no live address to link to. Nothing posted.");
  process.exit(2);
}

const { FB_PAGE_ID, FB_PAGE_TOKEN, IG_USER_ID } = process.env;
const dryRun = !FB_PAGE_ID || !FB_PAGE_TOKEN || !IG_USER_ID;

// ---------------------------------------------------------------- the article

const article = JSON.parse(await readFile(`${ARTICLES_DIR}/${slug}.json`, "utf8"));
const articleUrl = `${SITE_URL}/blog/${slug}/`;
// Cloudflare sits in front of one of the two sites, and it will cache a 404
// for hours if anything asks for the picture before the site has finished
// deploying. A fresh number on the end makes a different cache key every
// time, so both the check below and Instagram's own fetch reach the real file.
const imageUrl = `${SITE_URL}/blog-images/${slug}.jpg?v=${Date.now()}`;

// ---------------------------------------------------------------- the caption

// Returns { facebook, instagram }. Instagram captions carry no link, because
// Instagram does not make links in a caption clickable.
async function writeCaptions() {
  const plain = {
    facebook: `${article.excerpt}\n\n${articleUrl}`,
    instagram: `${article.excerpt}\n\nThe full piece is linked in our bio.`,
  };

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("No ANTHROPIC_API_KEY, so using the article's own summary as the caption");
    return plain;
  }

  let brief = "";
  try {
    brief = (await readFile(BRIEF_FILE, "utf8")).slice(0, 2000);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const prompt = [
    "Write the social posts for a new article on our blog.",
    brief && `This is how we write, so match it:\n${brief}`,
    `Article title: ${article.title}`,
    `What it covers: ${article.excerpt}`,
    `Its address: ${articleUrl}`,
    "",
    "Write two captions.",
    "",
    "The Facebook one: two short paragraphs. The first names the problem the",
    "reader actually has, in concrete terms, the way someone who does the work",
    "would say it. The second says what the article covers. Then the article's",
    "address on its own last line.",
    "",
    "The Instagram one: the same two paragraphs, then the line",
    '"The full piece is linked in our bio.", then three to five lowercase',
    "hashtags on one line.",
    "",
    "No emoji. No exclamation marks. Do not open with a question. Do not say",
    '"in today\'s fast-paced world", "game-changer", "unlock", "leverage",',
    '"dive into" or "revolutionize". Do not promise results we have not',
    "measured.",
    "",
    'Reply with only JSON: {"facebook": "...", "instagram": "..."}',
  ].filter(Boolean).join("\n");

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: CAPTION_MODEL,
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
    const body = await response.json();
    const text = body.content.map((part) => part.text || "").join("");
    const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const captions = JSON.parse(json);
    if (!captions.facebook || !captions.instagram) throw new Error("a caption came back empty");
    return captions;
  } catch (error) {
    console.error(`Claude could not write the caption (${error.message}), using the article's own summary`);
    return plain;
  }
}

// ------------------------------------------------------- waiting for the site

// Instagram fetches the picture from the live site, so the site has to have
// finished deploying before we post. One of the two sites is pulled onto its
// server by a job that runs every half hour, so this waits up to 40 minutes.
async function waitForImage(url) {
  const deadline = Date.now() + 40 * 60 * 1000;
  let waited = false;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { method: "HEAD", redirect: "follow" });
      if (response.ok) {
        if (waited) console.log("The cover picture is live.");
        return true;
      }
    } catch {
      // the site may be mid-deploy; try again
    }
    if (!waited) {
      console.log("Waiting for the cover picture to go live on the site...");
      waited = true;
    }
    await new Promise((resolve) => setTimeout(resolve, 20000));
  }
  return false;
}

// -------------------------------------------------------------------- posting

async function graph(path, params) {
  const response = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    body: new URLSearchParams({ ...params, access_token: FB_PAGE_TOKEN }),
  });
  const body = await response.json();
  if (!response.ok || body.error) {
    throw new Error(body.error ? `${body.error.message} (code ${body.error.code})` : `HTTP ${response.status}`);
  }
  return body;
}

// A re-run must not post the same article to the Page twice, so look for a
// recent Page post that already links this article.
async function alreadyOnFacebook() {
  try {
    const response = await fetch(
      `${GRAPH}/${FB_PAGE_ID}/posts?fields=message&limit=50&access_token=${encodeURIComponent(FB_PAGE_TOKEN)}`,
    );
    const body = await response.json();
    return (body.data || []).some((post) => (post.message || "").includes(`/blog/${slug}/`));
  } catch {
    return false;
  }
}

async function postToFacebook(message) {
  const result = await graph(`${FB_PAGE_ID}/photos`, { url: imageUrl, message, published: "true" });
  return result.post_id || result.id;
}

async function postToInstagram(caption) {
  // Instagram's picture fetch sometimes fails right after the picture goes
  // live ("Only photo or video can be accepted", 11/23), so try a few times.
  let container;
  for (let attempt = 1; ; attempt++) {
    try {
      container = await graph(`${IG_USER_ID}/media`, { image_url: imageUrl, caption });
      break;
    } catch (error) {
      if (attempt >= 3) throw error;
      console.log(`Instagram try ${attempt} failed (${error.message}); trying again in a minute.`);
      await new Promise((resolve) => setTimeout(resolve, 60000));
    }
  }

  // Instagram downloads the picture before it will publish, so wait for the
  // container to be ready rather than publishing straight away.
  for (let attempt = 0; attempt < 30; attempt++) {
    const status = await fetch(
      `${GRAPH}/${container.id}?fields=status_code,status&access_token=${encodeURIComponent(FB_PAGE_TOKEN)}`,
    ).then((response) => response.json());
    if (status.status_code === "FINISHED") break;
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
      throw new Error(`Instagram could not take the picture: ${status.status || status.status_code}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  const published = await graph(`${IG_USER_ID}/media_publish`, { creation_id: container.id });
  return published.id;
}

// ----------------------------------------------------------------------- main

const captions = await writeCaptions();

console.log(`\n--- Facebook ---\n${captions.facebook}\n`);
console.log(`--- Instagram ---\n${captions.instagram}\n`);
console.log(`--- Picture ---\n${imageUrl}\n`);

if (dryRun) {
  console.log("No Page id, token or Instagram id set, so nothing was posted.");
  process.exit(0);
}

if (!(await waitForImage(imageUrl))) {
  console.error(`The cover picture never appeared at ${imageUrl}. Nothing posted.`);
  process.exit(1);
}

let failed = false;

try {
  if (await alreadyOnFacebook()) {
    console.log("Already on the Facebook Page, so not posted there again.");
  } else {
    const postId = await postToFacebook(captions.facebook);
    console.log(`Posted to the Facebook Page: ${postId}`);
  }
} catch (error) {
  console.error(`Facebook refused the post: ${error.message}`);
  failed = true;
}

try {
  const mediaId = await postToInstagram(captions.instagram);
  console.log(`Posted to Instagram: ${mediaId}`);
} catch (error) {
  console.error(`Instagram refused the post: ${error.message}`);
  failed = true;
}

process.exit(failed ? 1 : 0);
