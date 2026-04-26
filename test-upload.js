import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testUpload() {
  const dummyFilePath = path.join(__dirname, 'dummy.txt');
  fs.writeFileSync(dummyFilePath, 'dummy content');

  const formData = new FormData();
  const fileBlob = new Blob(['dummy content'], { type: 'text/plain' });
  formData.append('file', fileBlob, 'dummy.txt');

  try {
    const res = await fetch('http://localhost:3001/api/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', data);
  } catch (e) {
    console.error('Error:', e);
  }
}

testUpload();
