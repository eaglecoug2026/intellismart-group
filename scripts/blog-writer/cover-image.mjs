// Draws an article's cover picture with OpenAI's image API and saves it to
// blog-images/<slug>.webp. The picture style for the site lives in
// blog-content/image-style.md; the scene comes from the writer.
import { mkdir, readFile, writeFile } from "node:fs/promises";

const IMAGES_DIR = "blog-images";
const STYLE_FILE = "blog-content/image-style.md";
const IMAGE_MODEL = "gpt-image-2";

// Returns the site path of the saved picture ("/blog-images/<slug>.webp"), or
// null when there's no OPENAI_API_KEY or the picture couldn't be made. A
// missing picture never stops the article.
export async function makeCover(slug, scene) {
  if (!process.env.OPENAI_API_KEY) {
    console.error("No OPENAI_API_KEY, so no cover picture");
    return null;
  }

  let style = "";
  try {
    style = (await readFile(STYLE_FILE, "utf8")).trim();
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const prompt = [
    style,
    `Scene: ${scene}`,
    "No text, words, letters, numbers, logos or brand marks anywhere in the picture, including on screens, papers and signs.",
  ].filter(Boolean).join("\n\n");

  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        prompt,
        size: "1536x1024",
        quality: "medium",
        output_format: "webp",
        output_compression: 80,
      }),
    });
    const data = await response.json();
    const b64 = data.data?.[0]?.b64_json;
    if (!response.ok || !b64) {
      console.error(`Cover picture failed: ${data.error?.message || `HTTP ${response.status}`}`);
      return null;
    }

    await mkdir(IMAGES_DIR, { recursive: true });
    await writeFile(`${IMAGES_DIR}/${slug}.webp`, Buffer.from(b64, "base64"));
    return `/${IMAGES_DIR}/${slug}.webp`;
  } catch (error) {
    console.error(`Cover picture failed: ${error.message}`);
    return null;
  }
}
