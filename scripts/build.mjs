import { access } from 'node:fs/promises';
for (const file of ['public/index.html','public/style.css','public/app.js','api/gateway.js','lib/chungsuc.js']) await access(new URL('../'+file, import.meta.url));
console.log('Static UI and API entry present. No bundling required.');
