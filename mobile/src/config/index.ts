import Constants from 'expo-constants';

// Expo doesn't load .env files automatically, so we hardcode for now
// In production, these would come from app.json extra config or EAS Secrets
export const config = {
  apiUrl: 'https://oncallshift.com/api',
  cognito: {
    userPoolId: 'us-east-1_vMk9CQycK',
    clientId: '38iilof80sp4jft1l8h8np4sjk',
    region: 'us-east-1',
  },
  // Expo project ID for push notifications
  expoProjectId: Constants.expoConfig?.extra?.eas?.projectId || '7311a48c-3b87-4bb8-8bba-549de8a578e7',
};

// Validate required config
if (!config.cognito.userPoolId || !config.cognito.clientId) {
  console.warn('Cognito configuration is incomplete.');
}

// Log config on startup (remove in production)
console.log('App Config:', {
  apiUrl: config.apiUrl,
  cognito: {
    userPoolId: config.cognito.userPoolId,
    clientId: config.cognito.clientId,
    region: config.cognito.region,
  },
});
