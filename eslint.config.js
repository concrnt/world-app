import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import prettier from "eslint-config-prettier";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default defineConfig(
    {
        ignores: [
            "**/dist/**",
            "**/node_modules/**",
            "worldlib/src/schemas/**",
            "worldlib/collectSchemas.ts",
            "src-tauri/**",
        ],
    },
    prettier,
    eslint.configs.recommended,
    tseslint.configs.recommended,
    {
        plugins: {
            react,
            "react-hooks": reactHooks,
        },
        settings: {
            react: {
                version: "detect",
            },
        },
        rules: {
            ...react.configs.recommended.rules,
            ...reactHooks.configs.recommended.rules,
        },
    },
    {
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "react/react-in-jsx-scope": "off",
            "@typescript-eslint/no-unused-vars": [
                "warn",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrors: "all",
                    caughtErrorsIgnorePattern: "^_",
                },
            ],
        }
    }
);

