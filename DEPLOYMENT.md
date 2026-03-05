# Node Banana — Deployment Guide

## Live URL
**https://nodes.aditor.ai** → Cloudflare Tunnel → `localhost:3100`

## Architecture
- **Server:** Alan's Mac mini (local machine, NOT a VPS)
- **App:** Next.js (custom server.js with 10min timeout for video gen)
- **Repo:** https://github.com/videoaditor/node-banana
- **Branch:** `develop` (production), `master` (old/stable)
- **Local path:** `/Users/player/clawd/projects/node-banana`
- **Port:** 3100
- **Service:** launchd `com.aditor.node-banana`
- **Tunnel:** Cloudflare Tunnel (cloudflared) → `nodes.aditor.ai`
- **Logs:** `/tmp/node-banana.log`
- **Env file:** `.env.local` (Next.js auto-loads this)

## API Keys Status
| Provider | Status | Used For |
|----------|--------|----------|
| Gemini | ✅ Configured | Image gen (primary), LLM |
| fal.ai | ✅ Configured | Nano Banana 2, Seedream, Flux |
| OpenAI | ✅ Configured | LLM, Sora |
| RunComfy | ✅ Configured | Kling, Wan, Hailuo |
| ElevenLabs | ✅ Configured | Voice synthesis |
| Replicate | ❌ No account | Optional models |
| Kie.ai | ❌ No account | Alt Sora/Veo/Kling |
| WaveSpeed | ❌ No account | Fast inference |

Check live status: `curl https://nodes.aditor.ai/api/env-status`

---

## Deploy from GitHub (Step by Step)

### 1. Pull latest code
```bash
cd /Users/player/clawd/projects/node-banana
git pull origin develop
```

### 2. Install dependencies (if package.json changed)
```bash
npm install
```

### 3. Build
```bash
npm run build
```

### 4. Restart the service
```bash
launchctl kickstart -k gui/$(id -u)/com.aditor.node-banana
```

### 5. Verify
```bash
# Wait 3 seconds for startup
sleep 3

# Check local
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3100

# Check live
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://nodes.aditor.ai
```

---

## One-Liner Deploy
```bash
cd /Users/player/clawd/projects/node-banana && git pull origin develop && npm install && npm run build && launchctl kickstart -k gui/$(id -u)/com.aditor.node-banana && sleep 3 && curl -s -o /dev/null -w "HTTP %{http_code}\n" https://nodes.aditor.ai
```

---

## Troubleshooting

### Check logs
```bash
tail -50 /tmp/node-banana.log
```

### Check if service is running
```bash
launchctl list | grep node-banana
# Should show PID + exit code 0
```

### Full restart (if kickstart doesn't work)
```bash
launchctl bootout gui/$(id -u)/com.aditor.node-banana
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.aditor.node-banana.plist
```

### Service plist location
```
~/Library/LaunchAgents/com.aditor.node-banana.plist
```

### Environment variables
Set in the plist file:
- `PORT=3100`
- `NODE_ENV=production`
- API keys loaded from `.env` in project root

---

## Branch Strategy
- **`develop`** — current production branch, all features merge here
- **`master`** — old stable (20+ commits behind develop)
- Deploy from `develop` unless rolling back
