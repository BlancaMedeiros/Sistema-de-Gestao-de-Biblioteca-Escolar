import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts'],
    // As métricas globais usam diferenças antes/depois de fixtures próprias.
    // Arquivos em série evitam interferência entre essas métricas e outras suites.
    fileParallelism: false,
  },
});
