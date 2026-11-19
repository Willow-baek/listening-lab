import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
const assets = {};
async function collect(directory) {
 for (const item of await readdir(directory, { withFileTypes: true })) {
  const filename = path.join(directory, item.name);
  if (item.isDirectory()) await collect(filename);
  else {
   const route = '/' + path.relative('dist', filename).split(path.sep).join('/');
   const type = {'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'}[path.extname(filename)] ?? 'application/octet-stream';
   assets[route] = {body:(await readFile(filename)).toString('base64'),type};
  }
 }
}
await collect('dist');
await rm('dist',{recursive:true,force:true});
await mkdir('dist/server',{recursive:true});
await mkdir('dist/.openai',{recursive:true});
await writeFile('dist/.openai/hosting.json',await readFile('.openai/hosting.json'));
await build({entryPoints:['worker/index.ts'],outfile:'dist/server/index.js',bundle:true,platform:'browser',format:'esm',target:'es2022',minify:true,define:{__STATIC_ASSETS__:JSON.stringify(assets)}});
console.log(`Hosted worker built with ${Object.keys(assets).length} embedded assets.`);
