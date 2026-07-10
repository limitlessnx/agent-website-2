# Boundless Flux AI — Website

Premium AI automation agency website built with Next.js 14, TypeScript, Tailwind CSS, and Framer Motion.

## Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + inline styles
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Deploy**: Vercel

## Pages

| Route | Page |
|-------|------|
| `/` | Home (hero, services, how it works, industries, demos, case studies, pricing, FAQ, CTA) |
| `/services` | Full services breakdown |
| `/industries` | Industry deep-dives |
| `/case-studies` | Real case studies with metrics |
| `/pricing` | Packages, add-ons, FAQ |
| `/about` | Story, values, tech stack |
| `/contact` | Contact form → API route |
| `/api/contact` | Form submission handler |

---

## 1. Run Locally

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/boundless-flux-ai.git
cd boundless-flux-ai

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your values

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 2. Push to GitHub

```bash
# Initialize git (if not already)
git init
git add .
git commit -m "Initial commit: Boundless Flux AI website"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/boundless-flux-ai.git
git branch -M main
git push -u origin main
```

---

## 3. Deploy to Vercel

**Option A — Vercel Dashboard (easiest):**
1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your GitHub repo
3. Add environment variables from `.env.example`
4. Click Deploy

**Option B — Vercel CLI:**
```bash
npm install -g vercel
vercel login
vercel --prod
```

---

## 4. Connect a Custom Domain

1. In Vercel dashboard → your project → Settings → Domains
2. Add your domain (e.g. `boundlessflux.ai`)
3. Copy the nameservers or DNS records Vercel gives you
4. Update your domain registrar (Namecheap, GoDaddy, Cloudflare, etc.)
5. SSL is automatic — usually live within 10 minutes

---

## 5. Connect Contact Form to n8n

1. In your n8n instance, create a new workflow
2. Add a **Webhook** trigger node
3. Set Method to `POST`, copy the webhook URL
4. Add `N8N_WEBHOOK_URL=https://...` to your `.env.local` on Vercel
5. Open `app/api/contact/route.ts`
6. Uncomment the n8n webhook block:

```typescript
const n8nUrl = process.env.N8N_WEBHOOK_URL;
if (n8nUrl) {
  await fetch(n8nUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(submission),
  });
}
```

7. In n8n, add downstream nodes: Slack notification, Supabase insert, email via Gmail/Resend, Calendly invite, etc.

---

## Connect Supabase (Lead Database)

```bash
npm install @supabase/supabase-js
```

Create table in Supabase:
```sql
create table contact_submissions (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  email text not null,
  phone text,
  business_type text not null,
  automation_goal text not null,
  budget text not null,
  source text,
  submitted_at timestamptz default now()
);
```

Uncomment the Supabase block in `app/api/contact/route.ts`.

---

## Project Structure

```
app/
  layout.tsx          # Root layout + metadata
  page.tsx            # Home page
  globals.css         # Design tokens + utility classes
  services/           # Services page
  industries/         # Industries page
  case-studies/       # Case studies page
  pricing/            # Pricing page
  about/              # About page
  contact/            # Contact form page
  api/contact/        # Form submission API route
components/
  Navbar.tsx          # Sticky navigation
  Footer.tsx          # Site footer
  Button.tsx          # Reusable button component
  SectionHeader.tsx   # Reusable section header
```
