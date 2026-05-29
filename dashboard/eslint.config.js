import antfu from '@antfu/eslint-config'

export default antfu({
  formatters: false,
  react: true,
  rules: {
    'react-refresh/only-export-components': 'off',
  },
  stylistic: false,
  typescript: true,
  ignores: [
    'dist',
    'src/routeTree.gen.ts',
  ],
})
