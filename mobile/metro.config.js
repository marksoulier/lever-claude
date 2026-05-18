const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// @supabase/supabase-js v2+ references @opentelemetry/api.
// babel-plugin-transform-dynamic-import converts the import() call to
// require() in babel.config.js. This resolver stubs the module itself
// so the require() resolves to an empty object — we don't use tracing.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith("@opentelemetry/")) {
    return { type: "empty" };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
