const { withAppBuildGradle } = require('expo/config-plugins');

const SIGNING_ENV = [
  'ANDROID_KEYSTORE_PATH',
  'ANDROID_KEYSTORE_PASSWORD',
  'ANDROID_KEY_ALIAS',
  'ANDROID_KEY_PASSWORD',
];

function withReleaseSigning(config) {
  const missing = SIGNING_ENV.filter((name) => !process.env[name]);

  if (process.env.CI === 'true' && missing.length > 0) {
    throw new Error(
      `Missing release signing environment variables: ${missing.join(', ')}`
    );
  }

  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    const releaseBlockPattern =
      /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/;

    if (!releaseBlockPattern.test(contents)) {
      throw new Error(
        '[withReleaseSigning] Could not find the release build type signing config in android/app/build.gradle'
      );
    }

    contents = contents.replace(
      releaseBlockPattern,
      '$1signingConfig signingConfigs.release'
    );

    const signingConfigsPattern = /signingConfigs\s*\{/;

    if (!signingConfigsPattern.test(contents)) {
      throw new Error(
        '[withReleaseSigning] Could not find signingConfigs in android/app/build.gradle'
      );
    }

    contents = contents.replace(
      signingConfigsPattern,
      `signingConfigs {
        release {
            def releaseKeystorePath = System.getenv("ANDROID_KEYSTORE_PATH")
            if (releaseKeystorePath) {
                storeFile file(releaseKeystorePath)
                storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias System.getenv("ANDROID_KEY_ALIAS")
                keyPassword System.getenv("ANDROID_KEY_PASSWORD")
            }
        }`
    );

    if (!contents.includes('signingConfig signingConfigs.release')) {
      throw new Error(
        '[withReleaseSigning] Release build type was not switched to signingConfigs.release'
      );
    }

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = withReleaseSigning;
