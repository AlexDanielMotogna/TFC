import 'dotenv/config';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { Server } from 'socket.io';
import { createLogger } from '@tfc/logger';
import { LOG_EVENTS, WS_EVENTS, type PlatformStatsPayload } from '@tfc/shared';
import { FightEngine } from './fight-engine.js';

const logger = createLogger({ service: 'realtime' });

const PORT = parseInt(process.env.REALTIME_PORT || '3002', 10);
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'dev-internal-key';

// Support multiple CORS origins (comma-separated in env var)
// Default: localhost for development
const CORS_ORIGINS = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:3001', 'http://localhost:3000'];

// For Socket.IO, we need a function to validate origins
function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // Allow requests without origin (like server-to-server)
  return CORS_ORIGINS.some(allowed => origin.startsWith(allowed) || allowed === '*');
}

// Helper to parse JSON body
async function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// Helper to send JSON response
function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function main() {
  logger.info(LOG_EVENTS.API_START, 'Starting realtime server', { port: PORT });

  // FightEngine will be created after io is initialized
  let fightEngine: FightEngine;

  // HTTP server with internal API endpoints
  const httpServer = createServer(async (req, res) => {
    // CORS headers - use request origin if allowed, otherwise first allowed origin
    const requestOrigin = req.headers.origin;
    const allowedOrigin = requestOrigin && isAllowedOrigin(requestOrigin)
      ? requestOrigin
      : CORS_ORIGINS[0];
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Internal-Key');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://localhost:${PORT}`);

    // Internal API endpoints for arena broadcasts (called by API server)
    if (url.pathname.startsWith('/internal/')) {
      // Verify internal API key
      const apiKey = req.headers['x-internal-key'];
      if (apiKey !== INTERNAL_API_KEY) {
        sendJson(res, 401, { error: 'Unauthorized' });
        return;
      }

      try {
        // Platform stats broadcast endpoint
        if (url.pathname === '/internal/platform-stats') {
          const body = (await parseBody(req)) as PlatformStatsPayload;

          // Broadcast to all connected clients
          io.emit(WS_EVENTS.PLATFORM_STATS, {
            ...body,
            timestamp: Date.now(),
          });

          logger.info(LOG_EVENTS.WS_BROADCAST, 'Emitted PLATFORM_STATS', {
            tradingVolume: body.tradingVolume,
            fightsCompleted: body.fightsCompleted,
          });
          sendJson(res, 200, { success: true });
          return;
        }

        // Stake info endpoint has different body shape
        if (url.pathname === '/internal/stake-info') {
          const body = (await parseBody(req)) as {
            fightId: string;
            userId: string;
            stake: number;
            currentExposure: number;
            maxExposureUsed: number;
            available: number;
          };

          if (!body.fightId || !body.userId) {
            sendJson(res, 400, { error: 'fightId and userId required' });
            return;
          }

          // Emit STAKE_INFO to the fight room
          io.to(`fight:${body.fightId}`).emit(WS_EVENTS.STAKE_INFO, body);
          logger.info(LOG_EVENTS.WS_BROADCAST, 'Emitted STAKE_INFO', {
            fightId: body.fightId,
            userId: body.userId,
            available: body.available,
          });
          sendJson(res, 200, { success: true });
          return;
        }

        const body = (await parseBody(req)) as { fightId?: string };
        const fightId = body.fightId;

        if (!fightId) {
          sendJson(res, 400, { error: 'fightId required' });
          return;
        }

        switch (url.pathname) {
          case '/internal/arena/fight-created':
            await fightEngine.broadcastArenaFightCreated(fightId);
            sendJson(res, 200, { success: true });
            break;

          case '/internal/arena/fight-updated':
            await fightEngine.broadcastArenaFightUpdated(fightId);
            sendJson(res, 200, { success: true });
            break;

          case '/internal/arena/fight-started':
            await fightEngine.broadcastArenaFightStarted(fightId);
            // Also trigger the existing onFightStarted for fight room
            await fightEngine.onFightStarted(fightId);
            sendJson(res, 200, { success: true });
            break;

          case '/internal/arena/fight-deleted':
            fightEngine.broadcastArenaFightDeleted(fightId);
            sendJson(res, 200, { success: true });
            break;

          default:
            sendJson(res, 404, { error: 'Not found' });
        }
      } catch (error) {
        logger.error(LOG_EVENTS.API_ERROR, 'Internal API error', error as Error);
        sendJson(res, 500, { error: 'Internal error' });
      }
      return;
    }

    // Health check
    if (url.pathname === '/health' && req.method === 'GET') {
      sendJson(res, 200, { status: 'ok', service: 'realtime' });
      return;
    }

    // Socket.IO handles everything else
  });

  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin || isAllowedOrigin(origin)) {
          callback(null, true);
        } else {
          logger.warn(LOG_EVENTS.WS_SUBSCRIBE, 'CORS blocked origin', { origin, allowed: CORS_ORIGINS });
          callback(new Error('CORS not allowed'), false);
        }
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  logger.info(LOG_EVENTS.API_START, 'CORS configured', { origins: CORS_ORIGINS });

  // Initialize fight engine
  fightEngine = new FightEngine(io);

  // Socket.IO connection handling
  io.on('connection', (socket) => {
    logger.info(LOG_EVENTS.WS_SUBSCRIBE, 'Client connected', {
      socketId: socket.id,
    });

    // Subscribe to arena (all fights updates)
    socket.on('arena:subscribe', () => {
      logger.info(LOG_EVENTS.WS_SUBSCRIBE, 'Client subscribed to arena', {
        socketId: socket.id,
      });
      socket.join('arena');
    });

    // Unsubscribe from arena
    socket.on('arena:unsubscribe', () => {
      logger.info(LOG_EVENTS.WS_UNSUBSCRIBE, 'Client unsubscribed from arena', {
        socketId: socket.id,
      });
      socket.leave('arena');
    });

    // Join fight room
    socket.on('join_fight', async (fightId: string) => {
      logger.info(LOG_EVENTS.WS_SUBSCRIBE, 'Client joining fight', {
        socketId: socket.id,
        fightId,
      });

      socket.join(`fight:${fightId}`);

      // Send current fight state
      const state = await fightEngine.getFightState(fightId);
      if (state) {
        socket.emit(WS_EVENTS.FIGHT_STATE, state);
      }
    });

    // Leave fight room
    socket.on('leave_fight', (fightId: string) => {
      logger.info(LOG_EVENTS.WS_UNSUBSCRIBE, 'Client leaving fight', {
        socketId: socket.id,
        fightId,
      });

      socket.leave(`fight:${fightId}`);
    });

    // Disconnect
    socket.on('disconnect', () => {
      logger.info(LOG_EVENTS.WS_UNSUBSCRIBE, 'Client disconnected', {
        socketId: socket.id,
      });
    });
  });

  // Start server
  httpServer.listen(PORT, () => {
    logger.info(LOG_EVENTS.API_START, 'Realtime server started', { port: PORT });
  });

  // Start fight engine tick loop
  fightEngine.startTickLoop();

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info(LOG_EVENTS.API_SHUTDOWN, 'Shutting down realtime server');

    fightEngine.stopTickLoop();

    httpServer.close(() => {
      logger.info(LOG_EVENTS.API_SHUTDOWN, 'Realtime server stopped');
      process.exit(0);
    });
  });
}

main().catch((error) => {
  logger.error(LOG_EVENTS.API_ERROR, 'Failed to start realtime server', error as Error);
  process.exit(1);
});
