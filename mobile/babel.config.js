module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // @supabase/supabase-js uses dynamic import() for OpenTelemetry.
      // Hermes (React Native's JS engine) rejects import() in production
      // builds. This plugin converts import() -> require() everywhere.
      "babel-plugin-transform-dynamic-import",
    ],
  };
};
