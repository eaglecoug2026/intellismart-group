# Intellismart Group Website

Static marketing site for `intellismartgroup.com`, adapted from the previous AI automation site design.

## Files

- `index.html` - homepage and AI readiness assessment
- `blog.html` - embedded blog page
- `images/` - visual assets used by the homepage
- `api/send-report.php` - assessment email endpoint
- `includes/email_helper.php` - SMTP helper configured by environment variables

## Server Configuration

Set the variables from `.env.example` in the hosting environment before enabling the assessment email endpoint. Do not commit real SMTP credentials.
