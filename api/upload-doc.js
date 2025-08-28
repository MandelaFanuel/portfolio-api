import { createClient } from '@supabase/supabase-js';

// Configuration Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'docs-private';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Types de documents
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

// Taille maximale du fichier (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Types MIME autorisés
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'image/gif'
]);

// Initialisation Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

// Validation des types de documents
const isValidDocType = (docType) => {
  return Object.prototype.hasOwnProperty.call(DOC_PATHS, docType);
};

// Validation du type MIME
const isValidMimeType = (mimeType) => {
  return ALLOWED_MIME_TYPES.has(mimeType);
};

// Middleware de validation
const validateRequest = (req) => {
  const origin = req.headers.origin || '';
  
  if (!ALLOWED_ORIGINS.has(origin)) {
    return { error: 'Origin not allowed', status: 403 };
  }

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

    // Parse du corps de la requête
    let body;
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (parseError) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const { password, docType, filename, contentBase64, mimeType } = body || {};

    // Validation des champs requis
    if (!password || !docType || !contentBase64) {
      return res.status(400).json({ 
        error: 'Missing required fields: password, docType, contentBase64' 
      });
    }

    // Vérification du mot de passe administrateur
    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized: Invalid password' });
    }

    // Validation du type de document
    if (!isValidDocType(docType)) {
      return res.status(400).json({ error: 'Invalid document type' });
    }

    // Validation du type MIME
    if (mimeType && !isValidMimeType(mimeType)) {
      return res.status(400).json({ error: 'Invalid file type' });
    }

    // Vérification de la taille du fichier
    const base64Length = contentBase64.length;
    const fileSize = Math.ceil(base64Length / 4) * 3; // Approximation de la taille
    if (fileSize > MAX_FILE_SIZE) {
      return res.status(400).json({ 
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` 
      });
    }

    // Décodage base64
    let buffer;
    try {
      buffer = Buffer.from(contentBase64, 'base64');
    } catch (decodeError) {
      return res.status(400).json({ error: 'Invalid base64 encoding' });
    }

    // Récupération du chemin du document
    const path = DOC_PATHS[docType];

    // Upload vers Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(path, buffer, {
        contentType: mimeType || 'application/octet-stream',
        upsert: true,
        cacheControl: '3600' // Cache d'une heure
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return res.status(500).json({ error: 'Upload failed' });
    }

    // Réponse sécurisée
    const origin = req.headers.origin || '';
    if (ALLOWED_ORIGINS.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Vary', 'Origin');

    return res.status(200).json({ 
      success: true,
      message: 'File uploaded successfully',
      documentType: docType,
      path: path
    });

  } catch (err) {
    console.error('Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}