import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, 'src');
const distDir = path.join(__dirname, 'dist');

console.log('Building Boardy static site...');

// 1. Clean dist folder
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// 2. Helper to copy directories recursively
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 3. Copy asset directories
const assetDirs = ['assets', 'channels', 'logos', 'tweets', 'videos'];
for (const dir of assetDirs) {
  const s = path.join(srcDir, dir);
  const d = path.join(distDir, dir);
  if (fs.existsSync(s)) {
    copyDir(s, d);
    console.log(`Copied ${dir}/`);
  }
}

// Copy root static files (.webp, .png, .jpg, .jpeg, .svg, .ico, .mp4, .md)
const rootFiles = fs.readdirSync(srcDir);
for (const file of rootFiles) {
  const fullPath = path.join(srcDir, file);
  const stat = fs.statSync(fullPath);
  if (stat.isFile() && !file.endsWith('.html')) {
    fs.copyFileSync(fullPath, path.join(distDir, file));
  }
}

// 4. Prepend api-mock & error suppression to index-BjgH2D5g.js so it runs without adding DOM script tags
const apiMockCode = `
// Boardy API Mock & React 418 Hydration Warning Suppression
(function() {
  if (typeof window !== 'undefined') {
    window.addEventListener('error', function(e) {
      if (e && (e.message && e.message.includes('418') || e.error && e.error.message && e.error.message.includes('418'))) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);

    if (!window.posthog) {
      window.posthog = {
        capture: function() {},
        identify: function() {},
        on: function() {},
        init: function() {},
        register: function() {},
        people: { set: function() {} }
      };
    }

    const origFetch = window.fetch;
    window.fetch = async function(resource, config) {
      const url = typeof resource === 'string' ? resource : resource instanceof URL ? resource.toString() : (resource && resource.url ? resource.url : '');

      if (url.includes('/api/public-globe')) {
        try {
          const response = await origFetch('/assets/public-globe.json');
          if (response.ok) {
            const data = await response.json();
            data.generatedAt = new Date().toISOString();
            data.status = 'ready';
            return new Response(JSON.stringify(data), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        } catch (err) {}
      }

      if (url.includes('/api/onboard/text')) {
        let body = {};
        try {
          if (config && config.body) {
            body = typeof config.body === 'string' ? JSON.parse(config.body) : config.body;
          }
        } catch (e) {}

        await new Promise(res => setTimeout(res, 200));

        const mockResponse = {
          success: true,
          phoneNumber: "+14159699735",
          smsBody: "Hey Boardy, I'd love your help with some warm introductions. Can we jump on a quick call?",
          qrCodeDataUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'><rect width='200' height='200' fill='white'/><path d='M20 20h40v40H20zM30 30h20v20H30zM140 20h40v40h-40zM150 30h20v20h-20zM20 140h40v40H20zM30 150h20v20H30zM80 30h10v10H80zM100 20h10v20h-10zM90 60h20v10H90zM30 80h20v10H30zM70 90h10v20H70zM90 80h20v20H90zM120 90h30v10h-30zM130 110h20v20h-20zM90 120h20v30H90zM120 140h10v20h-10zM140 150h20v10h-20z' fill='black'/></svg>",
          messageUrl: "sms:+14159699735?body=Hey%20Boardy%2C%20I'd%20love%20your%20help%20with%20some%20warm%20introductions.%20Can%20we%20jump%20on%20a%20quick%20call%3F"
        };

        return new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (url.includes('posthog') || url.includes('sentry') || url.includes('fbevents')) {
        return new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return origFetch.apply(this, arguments);
    };
  }
})();
`;

const bundledIndexPath = path.join(distDir, 'assets', 'index-BjgH2D5g.js');
if (fs.existsSync(bundledIndexPath)) {
  const originalCode = fs.readFileSync(bundledIndexPath, 'utf8');
  fs.writeFileSync(bundledIndexPath, apiMockCode + '\n' + originalCode);
  console.log('Injected mock & error handlers into dist/assets/index-BjgH2D5g.js');
}

// 5. Build HTML files without extra injected DOM nodes
function ensureLang(html) {
  if (!html.includes('<html lang="en"')) {
    return html.replace(/<html[^>]*>/i, '<html lang="en">');
  }
  return html;
}

// dist/index.html
if (fs.existsSync(path.join(srcDir, 'index.raw.html'))) {
  const raw = fs.readFileSync(path.join(srcDir, 'index.raw.html'), 'utf8');
  fs.writeFileSync(path.join(distDir, 'index.html'), ensureLang(raw));
  console.log('Built dist/index.html');
}

// dist/events/index.html
if (fs.existsSync(path.join(srcDir, 'events.raw.html'))) {
  const eventsDir = path.join(distDir, 'events');
  fs.mkdirSync(eventsDir, { recursive: true });
  const raw = fs.readFileSync(path.join(srcDir, 'events.raw.html'), 'utf8');
  fs.writeFileSync(path.join(eventsDir, 'index.html'), ensureLang(raw));
  console.log('Built dist/events/index.html');
}

// dist/booking/index.html
if (fs.existsSync(path.join(srcDir, 'booking.raw.html'))) {
  const bookingDir = path.join(distDir, 'booking');
  fs.mkdirSync(bookingDir, { recursive: true });
  const raw = fs.readFileSync(path.join(srcDir, 'booking.raw.html'), 'utf8');
  fs.writeFileSync(path.join(bookingDir, 'index.html'), ensureLang(raw));
  console.log('Built dist/booking/index.html');
}

// dist/chatgpt/index.html
if (fs.existsSync(path.join(srcDir, 'chatgpt.raw.html'))) {
  const chatgptDir = path.join(distDir, 'chatgpt');
  fs.mkdirSync(chatgptDir, { recursive: true });
  const raw = fs.readFileSync(path.join(srcDir, 'chatgpt.raw.html'), 'utf8');
  fs.writeFileSync(path.join(chatgptDir, 'index.html'), ensureLang(raw));
  console.log('Built dist/chatgpt/index.html');
}

// dist/articles/index.html
const articlesSrcDir = path.join(srcDir, 'articles');
const articlesDistDir = path.join(distDir, 'articles');
if (fs.existsSync(articlesSrcDir)) {
  copyDir(articlesSrcDir, articlesDistDir);
  console.log('Copied articles/ static files');
}

if (fs.existsSync(path.join(srcDir, 'articles.raw.html'))) {
  fs.mkdirSync(articlesDistDir, { recursive: true });
  const raw = fs.readFileSync(path.join(srcDir, 'articles.raw.html'), 'utf8');
  fs.writeFileSync(path.join(articlesDistDir, 'index.html'), ensureLang(raw));
  console.log('Built dist/articles/index.html');
}

console.log('Build complete! All files generated in app/dist/');
