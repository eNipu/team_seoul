import fs from 'node:fs';
import path from 'node:path';

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('Building static site for Boardy rebuild...');

const distDir = path.resolve('dist');
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// 1. Copy static asset directories
const staticDirs = ['assets', 'channels', 'logos', 'tweets'];
for (const dir of staticDirs) {
  const src = path.join('src', dir);
  if (fs.existsSync(src)) {
    copyDirSync(src, path.join(distDir, dir));
    console.log(`Copied ${dir}/ -> dist/${dir}/`);
  }
}

// 2. Copy root images and assets
const rootFiles = fs.readdirSync('src').filter(f => {
  const stat = fs.statSync(path.join('src', f));
  return stat.isFile() && !f.endsWith('.raw.html');
});
for (const f of rootFiles) {
  fs.copyFileSync(path.join('src', f), path.join(distDir, f));
}
console.log(`Copied ${rootFiles.length} root asset files.`);

// 3. Prepare index.html
let indexHtml = fs.readFileSync('../capture/page.html', 'utf8');
// Clean up external trackers that might throw errors or spam network
indexHtml = indexHtml.replace(/<script[^>]*us\.i\.posthog\.com[\s\S]*?<\/script>/gi, '');
// Inject api mock script before any module scripts
indexHtml = indexHtml.replace(
  '<head>',
  '<head>\n    <script src="/assets/api-mock.js"></script>'
);
fs.writeFileSync(path.join(distDir, 'index.html'), indexHtml);
console.log('Generated dist/index.html');

// 4. Prepare /events/index.html
fs.mkdirSync(path.join(distDir, 'events'), { recursive: true });
let eventsHtml = fs.readFileSync('src/events.raw.html', 'utf8');
eventsHtml = eventsHtml.replace(
  '<head>',
  '<head>\n    <script src="/assets/api-mock.js"></script>'
);
fs.writeFileSync(path.join(distDir, 'events', 'index.html'), eventsHtml);
console.log('Generated dist/events/index.html');

// 5. Prepare /booking/index.html
fs.mkdirSync(path.join(distDir, 'booking'), { recursive: true });
let bookingHtml = fs.readFileSync('src/booking.raw.html', 'utf8');
bookingHtml = bookingHtml.replace(
  '<head>',
  '<head>\n    <script src="/assets/api-mock.js"></script>'
);
fs.writeFileSync(path.join(distDir, 'booking', 'index.html'), bookingHtml);
console.log('Generated dist/booking/index.html');

// 6. Prepare /chatgpt/index.html
fs.mkdirSync(path.join(distDir, 'chatgpt'), { recursive: true });
let chatgptHtml = fs.readFileSync('src/chatgpt.raw.html', 'utf8');
chatgptHtml = chatgptHtml.replace(
  '<head>',
  '<head>\n    <script src="/assets/api-mock.js"></script>'
);
fs.writeFileSync(path.join(distDir, 'chatgpt', 'index.html'), chatgptHtml);
console.log('Generated dist/chatgpt/index.html');

// 7. Prepare /articles/index.html and its assets
fs.mkdirSync(path.join(distDir, 'articles'), { recursive: true });
if (fs.existsSync('src/articles')) {
  copyDirSync('src/articles', path.join(distDir, 'articles'));
}
let articlesHtml = fs.readFileSync('src/articles.raw.html', 'utf8');
articlesHtml = articlesHtml.replace(
  '<head>',
  '<head>\n    <script src="/assets/api-mock.js"></script>'
);
fs.writeFileSync(path.join(distDir, 'articles', 'index.html'), articlesHtml);
console.log('Generated dist/articles/index.html and article assets');

console.log('Build completed successfully!');
