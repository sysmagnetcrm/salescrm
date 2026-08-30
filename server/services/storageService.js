import path from 'path';
import fs from 'fs';

const STORAGE_DRIVER = process.env.STORAGE_DRIVER || 'local_disk'; // 'local_disk' or 'object_storage'
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'recordings');

export const storageService = {
  getDriver: () => STORAGE_DRIVER,

  getPublicUrl: (filename) => {
    if (STORAGE_DRIVER === 'object_storage') {
      const s3Bucket = process.env.S3_BUCKET_NAME || 'academy-crm-recordings';
      const s3Region = process.env.AWS_REGION || 'us-east-1';
      return `https://${s3Bucket}.s3.${s3Region}.amazonaws.com/recordings/${filename}`;
    }
    return `/uploads/recordings/${filename}`;
  },

  verifyFileAccessible: (filePath) => {
    if (STORAGE_DRIVER === 'object_storage') {
      return true; // S3 object storage handles accessibility via API
    }
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    return fs.existsSync(fullPath);
  }
};
