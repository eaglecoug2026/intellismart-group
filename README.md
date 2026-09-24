# Intellismart Group Website

Static marketing site for `intellismartgroup.com`, adapted from the previous AI automation site design.

## Files

- `index.html` - homepage and AI readiness assessment
- `blog.html` - legacy blog URL that points to `/blog/`
- `blog/index.html` - static blog index with crawlable article links
- `blog/<slug>/index.html` - generated static article pages
- `scripts/generate-soro-blog.mjs` - pulls Soro posts and creates real article URLs
- `sitemap.xml` - search sitemap with every generated blog URL
- `styles.css` - shared blog page styles
- `images/` - visual assets used by the homepage
- `api/send-report.php` - assessment email endpoint
- `includes/email_helper.php` - SMTP helper configured by environment variables

## Updating blog pages

Run this before deploying when Soro has new posts:

```bash
node scripts/generate-soro-blog.mjs
```

The script rebuilds `/blog/`, every `/blog/<slug>/` page, legacy `blog.html`, and `sitemap.xml`.

## Server Configuration

Set the variables from `.env.example` in the hosting environment before enabling the assessment email endpoint. Do not commit real SMTP credentials.
