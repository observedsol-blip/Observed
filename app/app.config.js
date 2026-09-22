// Build variants. app.json stays the source of truth; this only swaps what a variant must change.
//
// The diagnostics build must NOT occupy the production application id: it is signed with a
// throwaway key, and Android refuses to install a differently signed APK over an existing one.
// With its own id it sits beside the real app instead of blocking it (see docs/HANDOFF.md).
module.exports = ({ config }) => {
  // The tester build asks the memory question; it changes nothing else, so it needs no own id.
  if (process.env.APP_VARIANT === "tester") {
    return { ...config, extra: { ...(config.extra ?? {}), memoryQuestion: true } };
  }
  const diagnostics = process.env.APP_VARIANT === "diagnostics";
  if (!diagnostics) return config;
  return {
    ...config,
    name: "Observed Diag",
    // Read at runtime through expo-constants. __DEV__ is false in an EAS build, so it cannot be
    // the switch: the diagnostics screen would be unreachable (found on the device, 21.09.).
    extra: { ...(config.extra ?? {}), diagnostics: true },
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
