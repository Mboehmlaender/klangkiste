import { ensureSchema } from './index.js';

ensureSchema()
  .then(() => {
    console.log('✅ Datenbankschema abgeglichen.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('⚠️ Schema-Abgleich fehlgeschlagen:', error);
    process.exit(1);
  });
