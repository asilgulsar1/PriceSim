# 🚀 Deployment Guide - Price Simulation App

This guide will help you deploy your Price Simulation application so friends and partners can access it online.

## 📋 Prerequisites

- GitHub account (free)
- Vercel account (free) - or Netlify as alternative

---

## ✅ Option 1: Deploy to Vercel (Recommended)

### Why Vercel?
- ✨ **Free tier** with generous limits
- 🔒 **Automatic HTTPS**
- 🌐 **Custom domains** supported
- 🚀 **Auto-deploy** on every git push
- ⚡ **Optimized for Next.js** (your framework)

### Step-by-Step Instructions

#### 1. Commit Your Latest Changes

```bash
# Navigate to your project
cd "/Users/arshedgulshan/Documents/Software/Price Simulation"

# Add all files
git add .

# Commit with a message
git commit -m "Ready for deployment"
```

#### 2. Push to GitHub

If you haven't already created a GitHub repository:

1. Go to [github.com](https://github.com) and sign in
2. Click the **+** icon → **New repository**
3. Name it: `price-simulation` (or any name you prefer)
4. **Don't** initialize with README (you already have code)
5. Click **Create repository**

Then push your code:

```bash
# Add GitHub as remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/price-simulation.git

# Push your code
git push -u origin main
```

If you get an error about `main` vs `master`, try:
```bash
git branch -M main
git push -u origin main
```

#### 3. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **Sign Up** → Choose "Continue with GitHub"
3. Authorize Vercel to access your GitHub
4. Click **"Add New..."** → **"Project"**
5. Find and **Import** your `price-simulation` repository
6. Vercel will auto-detect Next.js settings:
   - Framework Preset: **Next.js** ✅
   - Build Command: `npm run build` ✅
   - Output Directory: `.next` ✅
7. Click **Deploy**

#### 4. Wait for Deployment (1-2 minutes)

Vercel will:
- Install dependencies
- Build your app
- Deploy to their CDN
- Give you a live URL

#### 5. Share Your App! 🎉

You'll get a URL like:
```
https://price-simulation-abc123.vercel.app
```

**Share this URL with your friends and partners!**

### 🎨 Optional: Add a Custom Domain

1. In Vercel dashboard → Your project → **Settings** → **Domains**
2. Add your domain (e.g., `pricesim.yourdomain.com`)
3. Follow DNS instructions
4. Vercel handles SSL automatically

---

## 🔄 Updating Your Deployed App

After making changes to your code:

```bash
# Commit your changes
git add .
git commit -m "Updated calculations"

# Push to GitHub
git push

# Vercel automatically deploys! ✨
```

Your live site updates in ~1 minute automatically.

---

## 🌐 Option 2: Deploy to Netlify (Alternative)

### Steps:

1. Push code to GitHub (same as above)
2. Go to [netlify.com](https://netlify.com)
3. Sign up with GitHub
4. Click **"Add new site"** → **"Import an existing project"**
5. Choose GitHub → Select your repository
6. Configure:
   - Build command: `npm run build`
   - Publish directory: `.next`
7. Click **Deploy**

You'll get a URL like: `https://price-simulation.netlify.app`

---

## 🔒 Option 3: Password Protection (Optional)

If you want to restrict access:

### Vercel Pro (Paid)
- Vercel Pro ($20/month) includes password protection
- Settings → Deployment Protection

### Free Alternative: Add Basic Auth

Create a middleware file:

```typescript
// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const basicAuth = request.headers.get('authorization');
  const url = request.nextUrl;

  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1];
    const [user, pwd] = atob(authValue).split(':');

    if (user === 'admin' && pwd === 'your-password-here') {
      return NextResponse.next();
    }
  }

  return new Response('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Area"',
    },
  });
}

export const config = {
  matcher: '/:path*',
};
```

---

## 📱 Option 4: Quick Local Network Share (Temporary)

To share with someone on your **same WiFi network**:

1. Find your local IP:
```bash
ipconfig getifaddr en0
# Example output: 192.168.1.100
```

2. Your app is already running on port 3000, so share:
```
http://192.168.1.100:3000
```

⚠️ **Note**: This only works while your computer is on and on the same network.

---

## 🎯 Recommended Setup for Your Use Case

**For Business Partners:**
1. ✅ Deploy to Vercel (free, professional)
2. ✅ Use custom domain if you have one
3. ✅ Add password protection if needed

**For Quick Testing:**
1. Use local network share (Option 4)

---

## 🆘 Troubleshooting

### Build Fails on Vercel

Check the build logs. Common issues:
- **TypeScript errors**: Fix in your code
- **Missing dependencies**: Run `npm install` locally first
- **Environment variables**: Add in Vercel dashboard if needed

### App Works Locally But Not on Vercel

- Check that all imports use correct paths
- Ensure no hardcoded `localhost` URLs
- Verify all dependencies are in `package.json`

---

## 📞 Need Help?

If you encounter issues:
1. Check Vercel deployment logs
2. Verify your build works locally: `npm run build`
3. Check the Vercel documentation: [vercel.com/docs](https://vercel.com/docs)

---

## 🎉 You're All Set!

Your Price Simulation app is now accessible to anyone with the URL. Share it with confidence!
