import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "data/**", "node_modules/**"]),
  {
    rules: {
      // We render AI text ourselves; this rule only helps with <img>.
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;
