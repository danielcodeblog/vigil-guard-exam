import { get } from 'https';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const MODEL_FILES = [
  'tiny_face_detector_model-shard1',
  'tiny_face_detector_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_expression_model-shard1',
  'face_expression_model-weights_manifest.json'
];

const BASE_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';

async function downloadModel(filename) {
  const url = BASE_URL + filename;
  console.log(`Downloading ${filename}...`);

  return new Promise((resolve, reject) => {
    get(url, (response) => {
      let data = [];
      response.on('data', (chunk) => data.push(chunk));
      response.on('end', () => {
        const buffer = Buffer.concat(data);
        writeFileSync(join('public', 'weights', filename), buffer);
        console.log(`Downloaded ${filename}`);
        resolve();
      });
    }).on('error', reject);
  });
}

console.log('Creating weights directory...');
mkdirSync(join('public', 'weights'), { recursive: true });

console.log('Downloading face-api.js model files...');
Promise.all(MODEL_FILES.map(downloadModel))
  .then(() => console.log('All models downloaded successfully!'))
  .catch(console.error);
