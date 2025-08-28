import { createClient } from '@supabase/supabase-js';

// Configuration Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'portofolioBucket';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Vérification des variables d'environnement
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE || !ADMIN_PASSWORD) {
  console.error('Missing environment variables:', {
    hasSupabaseUrl: !!SUPABASE_URL,
    hasSupabaseKey: !!SUPABASE_SERVICE_ROLE,
    hasAdminPassword: !!ADMIN_PASSWORD
  });
}

// Types de documents
const DOC_PATHS = {
  cv: 'cv.pdf',
  diplomas: 'diplomes.pdf',
  certifications: 'certifications.pdf',
  motivation: 'lettre_motivation.pdf',
  portfolio: 'presentation_portfolio.pdf',
};

// Origines autorisées
const ALLOWED_ORIGINS = new Set([
  'https://fanuel045.github.io',
  'https://fanuel045.vercel.app',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://localhost:3001'
]);

// Taille maximale et types MIME
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);

// Initialisation Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

// Validation des types de documents
const isValidDocType = (docType) => {
  return Object.prototype.hasOwnProperty.call(DOC_PATHS, docType);
};

const isValidMimeType = (mimeType) => {
  return ALLOWED_MIME_TYPES.has(mimeType);
};

// Handler pour générer une URL signée
const handleSignUrl = async (body, res) => {
  const { password, docType } = body;

  if (!docType) {
    return { error: 'Missing docType', status: 400 };
  }

  if (!isValidDocType(docType)) {
    return { error: 'Invalid document type', status: 400 };
  }

  // Vérification du mot de passe pour les documents sensibles
  const sensitiveDocs = ['diplomas', 'certifications', 'motivation', 'portfolio'];
  if (sensitiveDocs.includes(docType)) {
    if (!password || password !== ADMIN_PASSWORD) {
      return { error: 'Unauthorized: Password required', status: 401 };
    }
  }

  const path = DOC_PATHS[docType];
  const isCV = docType === 'cv';

  try {
    const { data, error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .createSignedUrl(path, 60, { download: isCV });

    if (error) {
      console.error('Supabase error:', error);
      return { error: 'Failed to generate signed URL', status: 500 };
    }

    return { 
      data: { 
        url: data.signedUrl,
        expiresAt: Date.now() + 60000
      }, 
      status: 200 
    };
  } catch (error) {
    console.error('Error in handleSignUrl:', error);
    return { error: 'Internal server error', status: 500 };
  }
};

// Handler pour uploader un fichier
const handleUpload = async (body, res) => {
  const { password, docType, contentBase64, mimeType } = body;

  if (!password || !docType || !contentBase64) {
    return { error: 'Missing required fields', status: 400 };
  }

  if (password !== ADMIN_PASSWORD) {
    return { error: 'Unauthorized: Invalid password', status: 401 };
  }

  if (!isValidDocType(docType)) {
    return { error: 'Invalid document type', status: 400 };
  }

  if (mimeType && !isValidMimeType(mimeType)) {
    return { error: 'Invalid file type', status: 400 };
  }

  // Vérification de la taille
  const fileSize = Math.ceil(contentBase64.length / 4) * 3;
  if (fileSize > MAX_FILE_SIZE) {
    return { error: `File too large. Max: ${MAX_FILE_SIZE / 1024 / 1024}MB`, status: 400 };
  }

  try {
    const buffer = Buffer.from(contentBase64, 'base64');
    const path = DOC_PATHS[docType];

    const { error: uploadError } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(path, buffer, {
        contentType: mimeType || 'application/pdf',
        upsert: true,
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return { error: 'Upload failed', status: 500 };
    }

    return { 
      data: { 
        success: true,
        message: 'File uploaded successfully',
        documentType: docType
      }, 
      status: 200 
    };
  } catch (error) {
    console.error('Error in handleUpload:', error);
    return { error: 'Internal server error', status: 500 };
  }
};

// Handler principal
export default async function handler(req, res) {
  // Configuration CORS
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Gestion des prévoltes CORS
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Vérification de la méthode
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Vérification Content-Type
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(400).json({ error: 'Content-Type must be application/json' });
    }

    // Parse du corps
    let body;
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (error) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const { action } = body;

    // Exécution de l'action
    let result;
    if (action === 'sign') {
      result = await handleSignUrl(body, res);
    } else if (action === 'upload') {
      result = await handleUpload(body, res);
    } else {
      return res.status(400).json({ error: 'Invalid action. Use "sign" or "upload"' });
    }

    // Retour de la réponse
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    } else {
      return res.status(result.status).json(result.data);
    }

  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}