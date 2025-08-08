import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createClient } from '@clickhouse/client';
import { logger } from '../utils/logger';

const app = new Hono();

// Enable CORS
app.use('*', cors());

// ClickHouse client
const clickhouse = createClient({
  url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
  database: process.env.CLICKHOUSE_DB || 'default',
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
});

// Health check endpoint
app.get('/health', async (c) => {
  try {
    await clickhouse.ping();
    return c.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (error) {
    return c.json({ status: 'unhealthy', error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'Hono API Server',
    description: 'Real-time ClickHouse data streaming via SSE',
    endpoints: {
      '/': 'API information',
      '/health': 'Health check',
      '/events': 'Server-Sent Events stream',
      '/demo': 'Interactive SSE demo'
    },
    timestamp: new Date().toISOString()
  });
});

// Server-Sent Events endpoint
app.get('/events', async (c) => {
  return c.newResponse(
    new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        
        // Send connection message
        controller.enqueue(encoder.encode('data: {"type":"connected","message":"SSE stream connected"}\n\n'));
        
        let lastCheck = Date.now();
        
        const poll = async () => {
          try {
            // Example: Query for recent data from materialized views
            const result = await clickhouse.query({
              query: `
                SELECT *
                FROM (
                  SELECT 'pumpfun_tokens' as source, name, symbol, creation_time as timestamp
                  FROM solana_pumpfun_tokens
                  WHERE creation_time > '${new Date(lastCheck).toISOString()}'
                  ORDER BY creation_time DESC
                  LIMIT 5
                )
                ORDER BY timestamp DESC
              `,
              format: 'JSONEachRow'
            });
            
            const data = await result.json();
            
            if (data.length > 0) {
              // Send new data to client
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'data',
                payload: data,
                timestamp: new Date().toISOString()
              })}\n\n`));
              
              lastCheck = Date.now();
            }
            
          } catch (error) {
            logger.error({ error }, 'SSE polling error');
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              message: 'Database query failed'
            })}\n\n`));
          }
        };
        
        // Poll every 3 seconds
        const interval = setInterval(poll, 3000);
        
        // Initial poll
        poll();
        
        // Cleanup on close
        return () => {
          clearInterval(interval);
        };
      }
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
});


// Start server
async function startServer() {
  const port = parseInt(process.env.PORT || '3001');
  
  logger.info('Starting Hono API Server...');
  
  try {
    // Test ClickHouse connection
    await clickhouse.ping();
    logger.info('ClickHouse connection established');
  } catch (error) {
    logger.warn({ error }, 'ClickHouse connection failed');
  }
  
  serve({
    fetch: app.fetch,
    port,
  });
  
  logger.info(`Server running on http://localhost:${port}`);
  logger.info('SSE endpoint available at /events');
  logger.info('Demo available at /demo');
}

// Run if this file is executed directly
if (require.main === module) {
  startServer().catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });
}
