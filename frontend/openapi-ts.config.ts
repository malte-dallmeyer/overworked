import { defineConfig } from '@hey-api/openapi-ts'

// Generates the typed API client from the backend's OpenAPI spec.
// Run via `node scripts/generate-api.mjs`; the output is committed.
export default defineConfig({
  input: '../openapi.json',
  output: 'src/api',
  plugins: ['@hey-api/client-fetch', '@hey-api/typescript', '@hey-api/sdk', '@tanstack/react-query'],
})
