import Constants from 'expo-constants';

// Expo doesn't load .env files automatically, so we hardcode for now
// In production, these would come from app.json extra config or EAS Secrets
export const config = {
  apiUrl: 'https://oncallshift.com/api',
  cognito: {
    userPoolId: 'REDACTED_COGNITO_POOL_ID',
    clientId: 'REDACTED_COGNITO_CLIENT_ID_3',
    region: 'us-east-1',
  },
  // Expo project ID for push notifications
  expoProjectId: Constants.expoConfig?.extra?.eas?.projectId || 'your-project-id-here',
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
