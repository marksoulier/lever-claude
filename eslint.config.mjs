import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Simulator / lib layer: stricter rules for financial math code.
  // These enforce the professional-grade standard defined in STEERING.md.
  {
    files: ["lib/**/*.ts"],
    rules: {
      // Unhandled promises in event handlers = silent broken simulation.
      "@typescript-eslint/no-floating-promises": "error",
      // console.log in simulator code = debug noise in production.
      "no-console": "warn",
      // Explicit any bypasses the type contract on PlanData / SimEvent.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
