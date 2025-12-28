import Constants from 'expo-constants';

export const config = {
  apiUrl: process.env.API_URL || 'http://localhost:3000/api',
  cognito: {
    userPoolId: process.env.COGNITO_USER_POOL_ID || '',
    clientId: process.env.COGNITO_CLIENT_ID || '',
    region: process.env.AWS_REGION || 'us-east-1',
  },
};

// Validate required config
if (!config.cognito.userPoolId || !config.cognito.clientId) {
  console.warn('Cognito configuration is incomplete. Please check your .env file.');
}
