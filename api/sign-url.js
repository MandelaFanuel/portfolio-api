import { createClient } from '@supabase/supabase-js';

// Configuration Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'docs-private';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Types de documents et leurs chemins
const DOC_PATHS = {
  cv: 'cv.pdf',
  diplomas: 'diplomes.pdf',
  certifications: 'certifications.pdf',
  motivation: 'lettre_motivation.pdf',
  portfolio: 'presentation_portfolio.pdf',
};

// Origines autorisées (CORS)
const ALLOWED_ORIGINS = new Set([
  'https://fanuel045.github.io',
  'https://fanuel045.vercel.app',
  'http://localhost:3000',
  'http://localhost:5500'
]);

// Initialisation Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

// Validation des types de documents
const isValidDocType = (docType) => {
  return Object.prototype.hasOwnProperty.call(DOC_PATHS, docType);
};

// Middleware de validation
const validateRequest = (req) => {
  const origin = req.headers.origin || '';
  
  // Vérification CORS
  if (!ALLOWED_ORIGINS.has(origin)) {
    return { error: 'Origin not allowed', status: 403 };
  }

  // Vérification méthode HTTP
  if (req.method !== 'POST' && req.method !== 'OPTIONS') {
    return { error: 'Method not allowed', status: 405 };
  }

  return { valid: true };
};

// Handler principal
export default async function handler(req, res) {
  try {
    // Validation de la requête
    const validation = validateRequest(req);
    if (validation.error) {
      return res.status(validation.status).json({ error: validation.error });
    }

    // Gestion des prévoltes CORS
    if (req.method === 'OPTIONS') {
      const origin = req.headers.origin || '';
      if (ALLOWED_ORIGINS.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      return res.status(204).end();
    }

    // Vérification Content-Type
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(400).json({ error: 'Content-Type must be application/json' });
    }

    // Parse et validation du corps de la requête
    let body;
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (parseError) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const { password, docType } = body || {};

    // Validation des champs requis
    if (!docType) {
      return res.status(400).json({ error: 'Missing docType' });
    }

    if (!isValidDocType(docType)) {
      return res.status(400).json({ error: 'Invalid document type' });
    }

    // Vérification du mot de passe pour les documents sensibles
    const sensitiveDocs = ['diplomas', 'certifications', 'motivation', 'portfolio'];
    if (sensitiveDocs.includes(docType)) {
      if (!password || password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized: Password required' });
      }
    }

    // Récupération du chemin du document
    const path = DOC_PATHS[docType];
    const isCV = docType === 'cv';

    // Génération de l'URL signée (valide 60 secondes)
    const { data, error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .createSignedUrl(path, 60, { 
        download: isCV 
      });

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to generate signed URL' });
    }

    // Réponse sécurisée
    const origin = req.headers.origin || '';
    if (ALLOWED_ORIGINS.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Vary', 'Origin');
    
    return res.status(200).json({ 
      url: data.signedUrl,
      expiresAt: Date.now() + 60000 // timestamp d'expiration
    });

  } catch (err) {
    console.error('Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}