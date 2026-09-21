// Build variants. app.json stays the source of truth; this only swaps what a variant must change.
//
// The diagnostics build must NOT occupy the production application id: it is signed with a
// throwaway key, and Android refuses to install a differently signed APK over an existing one.
// With its own id it sits beside the real app instead of blocking it (see docs/HANDOFF.md).
module.exports = ({ config }) => {
  const diagnostics = process.env.APP_VARIANT === "diagnostics";
  if (!diagnostics) return config;
  return {
    ...config,
    name: "Observed Diag",
    slug: config.slug,
    android: {
      ...config.android,
      package: `${config.android.package}.diag`,
    },
    ios: {
      ...config.ios,
      bundleIdentifier: `${config.ios.bundleIdentifier}.diag`,
    },
  };
};
