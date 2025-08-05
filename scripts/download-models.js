import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODEL_FILES = [
  'tiny_face_detector_model-shard1',
  'tiny_face_detector_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_expression_model-shard1',
  'face_expression_model-weights_manifest.json'
];

const BASE_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';
const MODEL_DIR = path.join(__dirname, '..', 'public', 'weights');

// Create the models directory if it doesn't exist
if (!fs.existsSync(MODEL_DIR)) {
  fs.mkdirSync(MODEL_DIR, { recursive: true });
}

console.log('Downloading face-api.js model files...');

// Download each model file
MODEL_FILES.forEach(filename => {
  const url = BASE_URL + filename;
  const filePath = path.join(MODEL_DIR, filename);

  console.log(`Downloading ${filename}...`);

  https.get(url, (response) => {
    const fileStream = fs.createWriteStream(filePath);
    response.pipe(fileStream);

    fileStream.on('finish', () => {
      fileStream.close();
      console.log(`Downloaded ${filename}`);
    });
  }).on('error', (err) => {
    console.error(`Error downloading ${filename}:`, err.message);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });
});
