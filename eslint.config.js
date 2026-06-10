const tsParser = require("@typescript-eslint/parser");

module.exports = [
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/.yarn/**",
      "**/to-process/**",
      "thesis/**",
      "studies/**",
    ],
  },
  {
    files: ["eslint.config.js", "packages/sage-*/**/*.{js,cjs,mjs}"], // TODO: Make this not as specific to sage packages
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: "module",
        ecmaVersion: "latest",
      },
    },
    rules: {
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    files: ["packages/sage-*/**/*.{ts,cts,mts}"], // TODO: Make this not as specific to sage packages
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: "module",
        ecmaVersion: "latest",
      },
    },
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSAnyKeyword",
          // TODO: Isn't there a more common way to achieve this?
          message:
            "Explicit 'any' is disallowed. Use concrete types, generics, or an inline eslint-disable with rationale when strictly necessary.",
        },
      ],
    },
  },
];
