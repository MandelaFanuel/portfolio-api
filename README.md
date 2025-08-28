# fanuel045-api (Vercel functions)

API serverless sécurisée pour générer des **URLs signées temporaires** vers des documents stockés dans un bucket **privé** Supabase Storage.

## 📋 Endpoints

### `POST /api/sign-url`
Génère une URL signée valable 60 secondes pour accéder à un document protégé.

**Body JSON:**
```json
{
  "password": "<MDP_SERVEUR>",
  "docType": "cv|diplomas|certifications|motivation|portfolio"
}