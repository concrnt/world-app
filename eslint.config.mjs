import globals from "globals";
import react from "eslint-plugin-react";

export default [
    {
        plugins: {
            react,
        },
        languageOptions: {
            globals: {
                ...globals.browser,
            },

            ecmaVersion: "latest",
            sourceType: "module",

            parserOptions: {
                project: ["tsconfig.json"],
            },

        },

        rules: {
        },
    },
];
