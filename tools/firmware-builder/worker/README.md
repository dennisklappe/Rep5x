# Rep5x Firmware Builder - Backend setup

This guide explains how to set up the cloud firmware build service using Cloudflare Workers and GitHub Actions.

## Architecture

```
User clicks Build → Cloudflare Worker → Triggers GitHub Action → Compiles → Uploads to R2 → User downloads
```

1. **Cloudflare Worker**: Receives build requests, stores config in KV, triggers GitHub Actions
2. **GitHub Actions**: Compiles firmware using PlatformIO, uploads to R2
3. **Cloudflare R2**: Stores compiled firmware binaries

## Prerequisites

- Cloudflare account (free tier works)
- GitHub repository with Actions enabled
- Node.js and npm installed locally

## Setup steps

### 1. Install Wrangler CLI

```bash
npm install -g wrangler
wrangler login
```

### 2. Create Cloudflare resources

```bash
cd tools/firmware-builder/worker

# Create KV namespace for build status
wrangler kv:namespace create BUILDS
# Note the ID and update wrangler.toml

# Create R2 bucket for firmware storage
wrangler r2 bucket create rep5x-firmware
```

### 3. Update wrangler.toml

Edit `wrangler.toml` and replace `YOUR_KV_NAMESPACE_ID` with the actual ID from step 2.

### 4. Create GitHub Personal Access Token

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. Create new token with:
   - Repository access: Select the Rep5x repository
   - Permissions:
     - Actions: Read and write
     - Contents: Read
3. Copy the token

### 5. Add secrets to Cloudflare Worker

```bash
wrangler secret put GITHUB_TOKEN
# Paste your GitHub token when prompted
```

### 6. Add secrets to GitHub repository

Go to your GitHub repo → Settings → Secrets and variables → Actions, and add:

- `R2_ACCESS_KEY_ID`: Your Cloudflare R2 access key ID
- `R2_SECRET_ACCESS_KEY`: Your Cloudflare R2 secret access key
- `R2_ENDPOINT`: Your R2 endpoint URL (e.g., `https://<account_id>.r2.cloudflarestorage.com`)

To get R2 credentials:
1. Go to Cloudflare dashboard → R2 → Manage R2 API Tokens
2. Create a new API token with read/write access to the `rep5x-firmware` bucket

### 7. Deploy the Worker

```bash
wrangler deploy
```

### 8. Configure custom domain (optional)

In Cloudflare dashboard:
1. Go to Workers & Pages → rep5x-firmware-builder
2. Settings → Triggers → Custom Domains
3. Add `firmware-builder.rep5x.com`

### 9. Test the setup

```bash
# Test the worker is running
curl https://firmware-builder.rep5x.com/

# Test a build (from the firmware builder UI)
# Click "Build firmware.bin" and watch the console
```

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/build` | POST | Start a new build |
| `/status/:buildId` | GET | Check build status |
| `/download/:buildId` | GET | Download firmware |
| `/config/:buildId` | GET | Get config (for GitHub Actions) |
| `/webhook` | POST | Build completion callback |

## Troubleshooting

### Build not starting
- Check GitHub token has correct permissions
- Verify workflow file exists at `.github/workflows/firmware-build.yml`
- Check Cloudflare Worker logs: `wrangler tail`

### Build fails
- Check GitHub Actions logs in the repository
- Verify R2 credentials are correct
- Check the Marlin branch exists

### Download fails
- Verify R2 bucket permissions
- Check firmware was uploaded (R2 dashboard)

## Costs

- **Cloudflare Workers**: Free tier includes 100,000 requests/day
- **Cloudflare KV**: Free tier includes 100,000 reads/day
- **Cloudflare R2**: Free tier includes 10GB storage, 10M reads/month
- **GitHub Actions**: Free for public repos, 2000 minutes/month for private

For a typical Rep5x project, this should be completely free.
