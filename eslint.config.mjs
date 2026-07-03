import effectEslint from "@effect/eslint-plugin";
import { fixupPluginRules } from "@eslint/compat";
import tsParser from "@typescript-eslint/parser";
import functional from "eslint-plugin-functional";
import _import from "eslint-plugin-import";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import sortDestructureKeys from "eslint-plugin-sort-destructure-keys";
import tseslint from "typescript-eslint";

const sourceFiles = ["packages/*/src/**/*.ts", "packages/*/src/**/*.tsx", "packages/*/scripts/**/*.ts"];
const rootScriptFiles = ["eslint.config.mjs", "scripts/**/*.mjs"];

const doubleAssertionSelector = {
  selector: "TSAsExpression > TSAsExpression",
  message: "Double type assertion requires eslint-disable with justification.",
};

const dateBanSelectors = [
  {
    selector: "NewExpression[callee.name='Date'][arguments.length=0]",
    message: "new Date() is banned. Inject a clock or pass time explicitly.",
  },
  {
    selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message: "Date.now() is banned. Inject a clock or pass time explicitly.",
  },
];

const mockBanSelectors = [
  "mock",
  "doMock",
  "unmock",
  "hoisted",
  "spyOn",
  "stubGlobal",
  "unstubAllGlobals",
  "mocked",
].map((member) => ({
  selector: `CallExpression[callee.object.name='vi'][callee.property.name='${member}']`,
  message: `vi.${member} is banned. Substitute behavior through a seam instead.`,
}));

export default [
  {
    ignores: ["**/dist", "**/coverage", "**/node_modules", "**/*.md"],
  },
  {
    plugins: {
      "@effect": effectEslint
    }
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: sourceFiles,
  })),
  ...effectEslint.configs.dprint.map((config) => ({
    ...config,
    files: [...sourceFiles, ...rootScriptFiles],
  })),
  {
    files: rootScriptFiles,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      "no-console": "off",
      "no-unused-vars": "error",
      "object-shorthand": "error",
    },
  },
  {
    files: sourceFiles,
    plugins: {
      "@effect": effectEslint,
      functional,
      import: fixupPluginRules(_import),
      "simple-import-sort": simpleImportSort,
      "sort-destructure-keys": sortDestructureKeys,
    },
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      "import/parsers": {
        "@typescript-eslint/parser": [".ts", ".tsx"],
      },
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: ["packages/*/tsconfig.json"],
        },
      },
    },
    rules: {
      "@effect/dprint": ["error", {
        config: {
          indentWidth: 2,
          lineWidth: 120,
          quoteStyle: "alwaysDouble",
          semiColons: "asi",
          trailingCommas: "never",
        },
      }],
      "@typescript-eslint/array-type": ["warn", {
        default: "generic",
        readonly: "generic",
      }],
      "@typescript-eslint/consistent-type-assertions": ["error", {
        assertionStyle: "as",
        objectLiteralTypeAssertions: "allow-as-parameter",
      }],
      "@typescript-eslint/consistent-type-imports": "warn",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
      "functional/functional-parameters": "off",
      "functional/immutable-data": "warn",
      "functional/no-class-inheritance": "off",
      "functional/no-classes": "off",
      "functional/no-conditional-statements": "off",
      "functional/no-expression-statements": "off",
      "functional/no-let": "off",
      "functional/no-loop-statements": "off",
      "functional/no-return-void": "off",
      "functional/no-throw-statements": "off",
      "functional/prefer-immutable-types": "off",
      "functional/prefer-tacit": "error",
      "import/first": "error",
      "import/no-duplicates": "error",
      "max-lines": ["error", {
        max: 420,
        skipBlankLines: true,
        skipComments: true,
      }],
      "no-console": "warn",
      "no-magic-numbers": ["warn", {
        enforceConst: true,
        ignore: [0, 1, 2, 10, 80, 200, 3000, 5000, 1024],
        ignoreArrayIndexes: true,
        ignoreDefaultValues: true,
      }],
      "no-restricted-syntax": [
        "error",
        doubleAssertionSelector,
        ...dateBanSelectors,
        ...mockBanSelectors,
        {
          selector: "TSAsExpression:not([typeAnnotation.type='TSConstKeyword'])",
          message: "Type assertion is banned. Use schemas, narrowing, discriminated unions, or satisfies.",
        },
      ],
      "object-shorthand": "error",
      "simple-import-sort/imports": "off",
      "sort-destructure-keys/sort-destructure-keys": "error",
    },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "functional/immutable-data": "off",
      "max-lines": "off",
      "no-magic-numbers": "off",
      "no-restricted-syntax": ["error", doubleAssertionSelector, ...dateBanSelectors, ...mockBanSelectors],
    },
  },
];
