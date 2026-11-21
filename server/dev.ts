import { createServer } from 'node:http';
import { loadEnv } from 'vite';
import { createHandler } from './handler.js';
const env = { ...loadEnv('development', process.cwd(), ''), ...process.env };
createServer(createHandler({ env })).listen(3001, '127.0.0.1', () => console.info('API locale: http://127.0.0.1:3001'));
