import globals from "globals";

export default [
  // Global ignores
  {
    ignores: [
      "node_modules/",
      "backups/",
      "dist/",
      "**/*.min.js",
    ],
  },

  // Backend — Node.js environment
  {
    files: ["ovira-api-main/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error",
      "semi": ["error", "always"],
      "quotes": ["warn", "single", { avoidEscape: true }],
      "eqeqeq": ["error", "always"],
    },
  },

  // Frontend — Browser environment
  {
    files: ["OVIRAPLAY-main/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error",
      "semi": ["error", "always"],
      "quotes": ["warn", "single", { avoidEscape: true }],
      "eqeqeq": ["error", "always"],
    },
  },
];
