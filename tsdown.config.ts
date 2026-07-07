import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    'cli/index': 'src/cli/index.ts',
  },
  copy: [{ from: 'src/cli/public', to: 'dist' }],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  dts: true,
  clean: true,
  sourcemap: true,
})
