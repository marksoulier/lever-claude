const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// @supabase/supabase-js v2+ contains a dynamic import() of @opentelemetry/api
// inside its compiled source. Hermes (React Native's JS engine) rejects
// dynamic import() in production builds.
//
// Two-part fix:
// 1. Force Metro to run Babel over the supabase packages so the dynamic
//    import() gets transformed to a Hermes-compatible form.
// 2. Stub @opentelemetry/* so the (now-transformed) import resolves to
//    an empty module — we don't use distributed tracing.

// Part 1 — include supabase packages in Babel transform
const { transformIgnorePatterns } = config.transformer;
config.transformer.transformIgnorePatterns = [
  "node_modules/(?!((@supabase|@opentelemetry)/|react-native-url-polyfill/))",
];

// Part 2 — resolve @opentelemetry/* to empty modules
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith("@opentelemetry/")) {
    return { type: "empty" };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
