# Lena Photo Processor (Standalone Static Web App)

A GitHub Pages-ready web app that:
- password-gates access,
- applies preset watermark + company logo,
- uses preset `Montserrat ExtraBold` font,
- processes multiple uploaded photos,
- places strain names on photos,
- downloads results as a ZIP (good for phone workflows).

## Layout rules implemented
- Watermark: stretched across the entire image.
- Company logo: bottom-right corner, 50% of image width (aspect ratio preserved).
- Strain name: top-left corner, black, all caps.

## Password
Current password configured in app:
- `karuna1234`

## Files
- `index.html`
- `styles.css`
- `app.js`
- `assets/fonts/Montserrat-ExtraBold.ttf`
- `assets/fonts/OFL.txt`
- `assets/images/` (optional default logo/watermark files)

## How presets work
You have two options:
1. Add default files to repo:
   - `assets/images/company-logo.png`
   - `assets/images/watermark.png`
2. Or set them from the app UI once using:
   - `Set/Replace Saved Logo`
   - `Set/Replace Saved Watermark`

When saved from the UI, assets are stored in that browser's `localStorage`.

## Deploy on GitHub Pages
1. Create a new GitHub repo and upload this folder contents.
2. In repo settings, enable GitHub Pages from branch root.
3. Open your GitHub Pages URL from Lena's phone.

## Security note
Because this is a static site, password protection is client-side only and not strong security. For true secure access control, use a server-backed gate (for example Cloudflare Access, Netlify Identity, or a backend auth layer).
