# core-dev - ClickHouse Schema Management

Core project template for managing ClickHouse schemas and materialized views.

## Quick Start

```bash
# Install dependencies
npm install

# Start ClickHouse with Docker
npm run docker:up

# Set environment variables
export CLICKHOUSE_URL=http://localhost:8123
export CLICKHOUSE_DB=default

# Sync views to database
npm run sync

# Test the simple-pipe
npm run start:simple-pipe
```

## Development Commands

```bash
# Docker management
npm run docker:up      # Start ClickHouse container
npm run docker:down    # Stop ClickHouse container

# Pipe development
npm run dev:simple-pipe    # Run simple-pipe in watch mode
npm run start:simple-pipe  # Run simple-pipe once

# View management
npm run sync           # Sync all views to ClickHouse
npm run build          # Build TypeScript
npm run typecheck      # Type check without building
```

## View Management

```bash
# Sync all views to ClickHouse
npm run sync
```

This reads all `.sql` files in the `sql/views/` directory and executes them against ClickHouse. Supports all ClickHouse view types: Regular Views, Materialized Views, Live Views (experimental), and Window Views (experimental).

## Architecture

```
Independent Pipes ──────────────────────► Base Tables
(pumpfun-tokens, hono, etc)           (Raw Data)
                                           │
                   View Sync ─────────────► All View Types
                   (sql/views/*.sql)       (Regular, Materialized, Live, Window)
```

## Configuration

## ⚙️ Configuration

Environment variables:

- `CLICKHOUSE_URL` - ClickHouse URL (default: http://localhost:8123)
- `CLICKHOUSE_DB` - Database name (default: default)
- `CLICKHOUSE_USER` - Username (default: default)
- `CLICKHOUSE_PASSWORD` - Password (default: empty)

## Project Structure

- `sql/views/*.sql` - All view types (regular, materialized, live, window)
- `sql/scripts/sync.ts` - View sync script that handles all view types
- `src/utils/` - Database utilities and logger
- `pipes/simple-pipe/` - Example pipe for development and testing

## View Types Supported

### 1. **Regular Views** (Virtual)
```sql
CREATE VIEW latest_transactions
AS SELECT * FROM transactions 
ORDER BY timestamp DESC LIMIT 100;
```

### 2. **Materialized Views** (Physical Storage)
```sql
CREATE MATERIALIZED VIEW daily_stats
ENGINE = SummingMergeTree()
ORDER BY date
POPULATE
AS SELECT 
    toDate(timestamp) as date,
    count() as transactions
FROM events GROUP BY date;
```

### 3. **Live Views** (Experimental - Auto-updating)
```sql
CREATE LIVE VIEW live_stats
AS SELECT count() as current_count
FROM events 
WHERE timestamp >= now() - INTERVAL 1 HOUR;
```

### 4. **Window Views** (Experimental - Time Windows)
```sql
CREATE WINDOW VIEW sliding_stats
ENGINE = SummingMergeTree
ORDER BY window_start
AS SELECT
    tumbleStart(wid) as window_start,
    count() as transaction_count
FROM events
GROUP BY tumble(timestamp, INTERVAL '1' HOUR) as wid;
```

## How It Works

1. Create or edit `.sql` files in the `sql/views/` directory
2. Run `npm run sync`
3. All views get dropped and recreated with latest definitions
4. Supports organizing views into separate files or folders

## Development Testing

The included `simple-pipe` can be used to test the entire pipeline:

1. Start ClickHouse: `npm run docker:up`
2. Run the pipe: `npm run start:simple-pipe`
3. Check the data and views in ClickHouse

## Perfect For

- Cross-pipe materialized views
- Schema management
- Data aggregations
- Analytics queries

Keep this project focused on schema management - use separate pipe modules for data ingestion and APIs!
