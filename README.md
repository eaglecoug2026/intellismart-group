# Intellismart Group Website

Static marketing site for `intellismartgroup.com`, adapted from the previous AI automation site design.

## Files

- `index.html` - homepage and the Free Business Automation Opportunity Assessment form (`/#assessment`)
- `blog.html` - legacy blog URL that points to `/blog/`
- `blog/index.html` - static blog index with crawlable article links
- `blog/<slug>/index.html` - generated static article pages
- `scripts/generate-soro-blog.mjs` - pulls Soro posts and creates real article URLs
- `sitemap.xml` - search sitemap with every generated blog URL
- `styles.css` - shared blog page styles
- `images/` - visual assets used by the homepage

## Updating blog pages

Run this before deploying when Soro has new posts:

```bash
node scripts/generate-soro-blog.mjs
```

The script rebuilds `/blog/`, every `/blog/<slug>/` page, legacy `blog.html`, and `sitemap.xml`.

## Assessment requests

GitHub Pages cannot run PHP, so the assessment form posts to `https://proctorpilot.com/api/group-lead.php` (repo `Intellismart-Group/proctorpilot`). That endpoint saves each request in the `group_leads` table and emails it to pohm@intellismartgroup.com. Link straight to the form with `/#assessment`, or `/?from=<page>#assessment` to record where the visitor came from.
