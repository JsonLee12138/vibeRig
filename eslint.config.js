import antfu from '@antfu/eslint-config';

export default antfu({
  typescript: true,
  formatters: true,
  stylistic: {
    indent: 2,
    quotes: 'single',
    semi: true,
  },
  ignores: [
    'dist/',
    'node_modules/',
    'coverage/',
    '.worktrees/',
    '.vibeRig/',
    '.pytest_cache/',
    '.playwright-mcp/',
  ],
});
