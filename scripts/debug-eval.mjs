import { callGemini } from '../llm/providers/gemini.mjs';
import fs from 'node:fs';

const env = fs.readFileSync('./frontend/server/data/workspace/.env', 'utf8');
const key = env.match(/GEMINI_API_KEY=(.+)/)[1].trim();

console.log('Testing callGemini with gemini-flash-lite-latest...');
const start = Date.now();
try {
  const res = await callGemini([
    { role: 'system', content: 'You evaluate Indian tech job fit and must return valid JSON only.' },
    { role: 'user', content: 'Candidate: Java fresher. Job: Senior RL Scientist. Evaluate and return JSON: {"score": 3.0, "grade": "D", "verdict": "Skip", "fit_summary": "Not a match"}' }
  ], {
    apiKey: key,
    model: 'gemini-flash-lite-latest',
    temperature: 0.1,
    maxOutputTokens: 1024,
    responseFormat: { type: 'json_object' }
  });
  console.log(`Success in ${Date.now() - start}ms! Output:`, res.text);
} catch (e) {
  console.log(`Error in ${Date.now() - start}ms:`, e.status, e.message);
}
