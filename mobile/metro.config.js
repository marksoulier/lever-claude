const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// @supabase/supabase-js v2+ bundles @opentelemetry which uses dynamic
// import() syntax that Hermes rejects in production builds. Stub it out.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith("@opentelemetry/")) {
    return { type: "empty" };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
