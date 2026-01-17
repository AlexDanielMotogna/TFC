# Railway Deployment Guide - TradeFightClub Backend

This guide covers deploying the realtime server and jobs to Railway.

## Prerequisites

1. Railway account (free tier available)
2. GitHub repository connected to Railway
3. Supabase database connection string

## Environment Variables Required

Both services need these environment variables:

```bash
# Database
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.kewjuklpqxpiyojaazip.supabase.co:5432/postgres

# Authentication
JWT_SECRET=your-jwt-secret-here
INTERNAL_API_KEY=your-internal-api-key-here

# Pacifica API (for jobs)
PACIFICA_API_KEY=your-pacifica-api-key
PACIFICA_API_URL=https://api.pacifica.exchange

# Feature Flags (optional)
FEATURE_DEPOSITS_ENABLED=true
FEATURE_POOL_CREATION_ENABLED=true
FEATURE_SETTLEMENT_ENABLED=true
FEATURE_TRADING_ENABLED=true
```

## Deployment Steps

### 1. Deploy Realtime Server

1. Go to Railway dashboard → New Project → Deploy from GitHub repo
2. Select your TradeFightClub repository
3. Railway will detect the monorepo
4. Configure the service:
   - **Name**: `tfc-realtime`
   - **Root Directory**: Leave as root (Dockerfile handles it)
   - **Dockerfile Path**: `apps/realtime/Dockerfile`
   - **Port**: `3002` (Railway will auto-assign public URL)

5. Add environment variables (see above)

6. Deploy!

### 2. Deploy Jobs Service

1. In the same Railway project → Add New Service → GitHub repo
2. Select the same repository
3. Configure the service:
   - **Name**: `tfc-jobs`
   - **Root Directory**: Leave as root
   - **Dockerfile Path**: `apps/jobs/Dockerfile`
   - **No port needed** (jobs doesn't expose HTTP)

4. Add the same environment variables

5. Deploy!

### 3. Update Vercel Environment Variables

After deployment, get the realtime server URL from Railway (e.g., `https://tfc-realtime.railway.app`) and add to Vercel:

```bash
REALTIME_URL=https://tfc-realtime.railway.app
```

Then redeploy Vercel to pick up the new env var.

## Monitoring

- Railway provides logs for both services in real-time
- Check Railway dashboard for deployment status
- Realtime server health check: `https://your-realtime-url.railway.app/health`

## Troubleshooting

### Build fails with Prisma error
- Ensure DATABASE_URL is set in environment variables
- Check that the connection string is correct

### Realtime server not connecting
- Verify PORT is set to 3002
- Check Railway assigned a public domain
- Ensure Vercel has correct REALTIME_URL

### Jobs not running
- Check Railway logs for cron job execution
- Verify DATABASE_URL is accessible
- Check PACIFICA_API_KEY is valid

## Cost Estimate

Railway free tier includes:
- $5 usage credit per month
- Realtime server: ~$3-5/month (low traffic)
- Jobs: ~$1-2/month (runs periodically)

Total: **Free tier should cover staging deployment**

## Production Considerations

For production:
- Upgrade to Railway Pro ($20/month)
- Enable auto-scaling for realtime server
- Set up monitoring/alerts
- Configure custom domains
- Enable health checks with auto-restart
