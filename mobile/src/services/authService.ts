import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';
import * as SecureStore from 'expo-secure-store';
import { config } from '../config';

// Auth state change listeners
type AuthStateListener = (isAuthenticated: boolean) => void;
const authStateListeners: Set<AuthStateListener> = new Set();

export const addAuthStateListener = (listener: AuthStateListener) => {
  authStateListeners.add(listener);
  return () => authStateListeners.delete(listener);
};

const notifyAuthStateChange = (isAuthenticated: boolean) => {
  authStateListeners.forEach(listener => listener(isAuthenticated));
};

const userPool = new CognitoUserPool({
  UserPoolId: config.cognito.userPoolId,
  ClientId: config.cognito.clientId,
});

export interface AuthUser {
  email: string;
  accessToken: string;
  idToken: string;
  refreshToken: string;
}

/**
 * Sign in with email and password
 */
export const signIn = (email: string, password: string): Promise<AuthUser> => {
  return new Promise((resolve, reject) => {
    const authenticationDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    });

    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool,
    });

    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: async (session: CognitoUserSession) => {
        const authUser: AuthUser = {
          email,
          accessToken: session.getAccessToken().getJwtToken(),
          idToken: session.getIdToken().getJwtToken(),
          refreshToken: session.getRefreshToken().getToken(),
        };

        // Store tokens separately to avoid SecureStore size limit
        await SecureStore.setItemAsync('auth_email', email);
        await SecureStore.setItemAsync('auth_accessToken', authUser.accessToken);
        await SecureStore.setItemAsync('auth_idToken', authUser.idToken);
        await SecureStore.setItemAsync('auth_refreshToken', authUser.refreshToken);

        resolve(authUser);
      },
      onFailure: (err) => {
        reject(err);
      },
    });
  });
};

/**
 * Sign out current user
 */
export const signOut = async (): Promise<void> => {
  const currentUser = userPool.getCurrentUser();
  if (currentUser) {
    currentUser.signOut();
  }
  // Clear all stored tokens
  await SecureStore.deleteItemAsync('auth_email');
  await SecureStore.deleteItemAsync('auth_accessToken');
  await SecureStore.deleteItemAsync('auth_idToken');
  await SecureStore.deleteItemAsync('auth_refreshToken');
  // Legacy cleanup
  await SecureStore.deleteItemAsync('authUser');
  notifyAuthStateChange(false);
};

/**
 * Get current authenticated user
 */
export const getCurrentUser = async (): Promise<AuthUser | null> => {
  try {
    const email = await SecureStore.getItemAsync('auth_email');
    const accessToken = await SecureStore.getItemAsync('auth_accessToken');
    const idToken = await SecureStore.getItemAsync('auth_idToken');
    const refreshToken = await SecureStore.getItemAsync('auth_refreshToken');

    if (!email || !accessToken) {
      return null;
    }

    return {
      email,
      accessToken,
      idToken: idToken || '',
      refreshToken: refreshToken || '',
    };
  } catch (_error) {
    return null;
  }
};

/**
 * Get access token for API requests (with automatic refresh)
 */
export const getAccessToken = async (): Promise<string | null> => {
  try {
    const cognitoUser = userPool.getCurrentUser();

    if (!cognitoUser) {
      // No active Cognito session, try stored tokens
      const storedToken = await SecureStore.getItemAsync('auth_accessToken');
      return storedToken || null;
    }

    // Get session with automatic token refresh
    return new Promise((resolve) => {
      cognitoUser.getSession(async (err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session || !session.isValid()) {
          // Session expired
          await signOut();
          notifyAuthStateChange(false);
          resolve(null);
          return;
        }

        const accessToken = session.getAccessToken().getJwtToken();

        // Update stored tokens with refreshed values
        await SecureStore.setItemAsync('auth_accessToken', accessToken);
        await SecureStore.setItemAsync('auth_idToken', session.getIdToken().getJwtToken());

        resolve(accessToken);
      });
    });
  } catch (_error) {
    return null;
  }
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = async (): Promise<boolean> => {
  const user = await getCurrentUser();
  return user !== null;
};

/**
 * Initiate forgot password flow - sends verification code to email
 */
export const forgotPassword = (email: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool,
    });

    cognitoUser.forgotPassword({
      onSuccess: () => {
        resolve();
      },
      onFailure: (err) => {
        reject(err);
      },
      inputVerificationCode: () => {
        // This is called when the code is sent successfully
        resolve();
      },
    });
  });
};

/**
 * Confirm new password with verification code
 */
export const confirmPassword = (
  email: string,
  verificationCode: string,
  newPassword: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool,
    });

    cognitoUser.confirmPassword(verificationCode, newPassword, {
      onSuccess: () => {
        resolve();
      },
      onFailure: (err) => {
        reject(err);
      },
    });
  });
};
