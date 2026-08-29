import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads/branding directory exists
const brandingDir = path.join(__dirname, '../../uploads/branding');
if (!fs.existsSync(brandingDir)) {
  fs.mkdirSync(brandingDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, brandingDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const prefix = file.fieldname === 'favicon' ? 'branding-favicon-' : 'branding-logo-';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, prefix + uniqueSuffix + ext);
  }
});

const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico'];
const ALLOWED_MIMES = [
  'image/png',
  'image/jpeg',
  'image/pjpeg',
  'image/webp',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon'
];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype.toLowerCase();

  // Reject executable file extensions explicitly
  const FORBIDDEN_EXTS = ['.php', '.js', '.html', '.htm', '.exe', '.sh', '.bat', '.cmd', '.pl', '.py', '.cgi'];
  if (FORBIDDEN_EXTS.includes(ext)) {
    return cb(new Error('Security Error: Uploading executable or script files is strictly forbidden.'), false);
  }

  if (ALLOWED_EXTENSIONS.includes(ext) && ALLOWED_MIMES.includes(mime)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid image format. Allowed formats: ${ALLOWED_EXTENSIONS.join(', ')}`), false);
  }
};

export const uploadBranding = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB maximum size limit
  }
});
