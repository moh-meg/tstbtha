import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {pathToFileURL} from 'url';
import {defineConfig, type Plugin} from 'vite';

function localNetlifyFunctionsPlugin(): Plugin {
  return {
    name: 'local-netlify-functions-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const parsedReqUrl = new URL(req.url || '/', 'http://localhost');
        const reqPath = parsedReqUrl.pathname;
        let fnRelativePath: string | null = null;

        if (reqPath === '/api/matches' || reqPath === '/.netlify/functions/matches') {
          fnRelativePath = 'netlify/functions/matches.js';
        } else if (reqPath === '/api/players' || reqPath === '/.netlify/functions/players') {
          fnRelativePath = 'netlify/functions/players.js';
        } else if (
          reqPath === '/api/fpl-squad' ||
          reqPath === '/.netlify/functions/fpl-squad'
        ) {
          fnRelativePath = 'netlify/functions/fpl-squad.js';
        } else if (
          reqPath === '/api/player-photo' ||
          reqPath === '/.netlify/functions/player-photo'
        ) {
          fnRelativePath = 'netlify/functions/player-photo.js';
        } else if (
          reqPath === '/api/team-counts' ||
          reqPath === '/.netlify/functions/team-counts'
        ) {
          fnRelativePath = 'netlify/functions/team-counts.js';
        }

        if (!fnRelativePath) {
          next();
          return;
        }

        try {
          const baseDir = import.meta.dirname ?? process.cwd();
          const fnUrl = pathToFileURL(path.resolve(baseDir, fnRelativePath)).href;
          const mod = await import(/* @vite-ignore */ fnUrl);
          const result = await mod.handler({
            path: reqPath,
            rawQuery: parsedReqUrl.search.slice(1),
            queryStringParameters: Object.fromEntries(parsedReqUrl.searchParams.entries()),
          });
          res.statusCode = result.statusCode;
          for (const [key, value] of Object.entries(result.headers || {})) {
            res.setHeader(key, String(value));
          }
          res.end(
            result.isBase64Encoded
              ? Buffer.from(String(result.body || ''), 'base64')
              : result.body,
          );
        } catch {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({error: 'Local function handler failed'}));
        }
      });
    },
  };
}

export default defineConfig(() => {
  const baseDir = import.meta.dirname ?? process.cwd();
  return {
    plugins: [
      react(),
      tailwindcss(),
      localNetlifyFunctionsPlugin(),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(baseDir, 'dist');
          const srcAssets = path.resolve(baseDir, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(baseDir, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
