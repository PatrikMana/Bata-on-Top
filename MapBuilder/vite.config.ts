import fs from 'node:fs/promises';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const MAPS_DIRECTORY = path.resolve(__dirname, 'maps');

type CreateMapRequest = {
  name?: string;
};

function slugifyMapName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function ensureMapsDirectory() {
  await fs.mkdir(MAPS_DIRECTORY, { recursive: true });
}

async function readRequestBody(request: IncomingMessage) {
  let body = '';

  for await (const chunk of request) {
    body += chunk;
  }

  return body;
}

function sendJson(response: ServerResponse, statusCode: number, data: unknown) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(data));
}

async function listMaps() {
  await ensureMapsDirectory();

  const entries = await fs.readdir(MAPS_DIRECTORY, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      id: entry.name,
      name: entry.name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function createMap(name: string) {
  await ensureMapsDirectory();

  const id = slugifyMapName(name);

  if (!id) {
    return { status: 400, body: { message: 'Nazev mapy musi obsahovat aspon jeden znak.' } };
  }

  const mapDirectory = path.join(MAPS_DIRECTORY, id);

  try {
    await fs.mkdir(mapDirectory);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
      return { status: 409, body: { message: 'Mapa s timto nazvem uz existuje.' } };
    }

    throw error;
  }

  return {
    status: 201,
    body: {
      id,
      name: id,
    },
  };
}

function mapsApiPlugin(): Plugin {
  return {
    name: 'map-builder-api',
    configureServer(server) {
      server.middlewares.use('/api/maps', async (request, response) => {
        try {
          if (request.method === 'GET') {
            sendJson(response, 200, { maps: await listMaps() });
            return;
          }

          if (request.method === 'POST') {
            const body = await readRequestBody(request);
            const data = JSON.parse(body || '{}') as CreateMapRequest;
            const result = await createMap(data.name?.trim() ?? '');

            sendJson(response, result.status, result.body);
            return;
          }

          sendJson(response, 405, { message: 'Metoda neni podporovana.' });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Neocekavana chyba.';
          sendJson(response, 500, { message });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), mapsApiPlugin()],
});
