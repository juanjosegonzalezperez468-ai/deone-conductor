const base = require('./app.json');

module.exports = {
  ...base,
  expo: {
    ...base.expo,
    android: {
      ...base.expo.android,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '',
        },
      },
    },
  },
};
