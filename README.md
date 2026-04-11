# Pawganic (React + Tailwind)

Modern single-page site for **Pawganic**, a homemade organic dog food brand.

## Setup

1) Install **Node.js (LTS)** which includes `npm`.
2) In this folder, run:

```bash
npm install
npm run dev
```

## API URL configuration (for GoDaddy/static hosting)

When frontend and backend are on different hosts, set:

```bash
VITE_API_BASE_URL=https://YOUR-BACKEND-DOMAIN/api
```

Then rebuild:

```bash
npm run build
```

## Customize

- Update WhatsApp number in `src/App.jsx` (`WHATSAPP_NUMBER`)
- Update social links in `src/App.jsx` (`socials.instagram`, `socials.facebook`)

