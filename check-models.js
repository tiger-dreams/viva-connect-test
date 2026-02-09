
import mod from 'node:module';
const require = mod.createRequire(import.meta.url);
const https = require('https');
const fs = require('fs');
const path = require('path');

// Load .env if available
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envConfig = require('dotenv').parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
      process.env[k] = envConfig[k];
    }
  }
} catch (e) {
  console.log('Could not load .env file', e);
}

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error('Error: GEMINI_API_KEY is not set in environment or .env file');
  process.exit(1);
}

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

console.log('Fetching models from:', 'https://generativelanguage.googleapis.com/v1beta/models');

https.get(url, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      if (response.error) {
        console.error('API Error:', response.error);
        return;
      }

      if (!response.models) {
        console.log('No models found.');
        return;
      }

      console.log('\n--- Supported Models for bidiGenerateContent ---');
      const bidiModels = response.models.filter(m => 
        m.supportedGenerationMethods && m.supportedGenerationMethods.includes('bidiGenerateContent')
      );

      if (bidiModels.length === 0) {
        console.log('No models found that support bidiGenerateContent.');
        console.log('\n--- All Available Models (for reference) ---');
        response.models.sort((a, b) => b.displayName.localeCompare(a.displayName)).forEach(m => {
             console.log(`- ${m.name.split('/').pop()} (${m.displayName})`);
             console.log(`  Methods: ${m.supportedGenerationMethods.join(', ')}`);
        });
      } else {
        bidiModels.sort((a, b) => b.displayName.localeCompare(a.displayName)).forEach(m => {
          console.log(`\nModel: ${m.name}`);
          console.log(`Name: ${m.displayName}`);
          console.log(`Description: ${m.description}`);
          console.log(`Supported Methods: ${m.supportedGenerationMethods.join(', ')}`);
        });
      }

      console.log('\n----------------------------------------------');

    } catch (e) {
      console.error('Error parsing response:', e);
      console.log('Raw data:', data);
    }
  });

}).on('error', (e) => {
  console.error('Request error:', e);
});
