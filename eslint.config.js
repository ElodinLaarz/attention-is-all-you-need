// eslint.config.js
import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Add any project-specific rule overrides here
      // For example, if you are using Angular and have specific needs:
      // "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    // Ignoring build artifacts, node_modules, and husky internal files
    ignores: [
      '**/node_modules/',
      '**/dist/',
      '.husky/_/',
      'frontend/src/app/components/attention-visualizer/attention-visualizer.component.scss.bak',
      'frontend/.angular/cache/',
      'frontend/.angular/cache/**',
      'frontend/public/',
      'frontend/public/**',
      '.conda/',
      '.conda/**',
      // ...add other generated or build folders as needed...
    ],
  },
];
