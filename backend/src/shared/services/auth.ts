import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  GlobalSignOutCommand,
  DescribeUserPoolCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const cognito = new CognitoIdentityProviderClient({ region: env.awsRegion });

/**
 * Sign up a new user in Cognito.
 */
export async function signUp(
  email: string,
  password: string,
  attributes: Record<string, string> = {},
): Promise<{ userSub: string; confirmed: boolean }> {
  const userAttributes = [
    { Name: "email", Value: email },
    ...Object.entries(attributes).map(([Name, Value]) => ({ Name, Value })),
  ];

  const result = await cognito.send(
    new SignUpCommand({
      ClientId: env.cognitoClientId,
      Username: email,
      Password: password,
      UserAttributes: userAttributes,
    }),
  );

  logger.info("User signed up in Cognito", { email });
  return {
    userSub: result.UserSub!,
    confirmed: result.UserConfirmed ?? false,
  };
}

/**
 * Authenticate with email/password using SRP flow.
 */
export async function login(
  email: string,
  password: string,
): Promise<{
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const result = await cognito.send(
    new InitiateAuthCommand({
      ClientId: env.cognitoClientId,
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    }),
  );

  const auth = result.AuthenticationResult!;
  return {
    accessToken: auth.AccessToken!,
    idToken: auth.IdToken!,
    refreshToken: auth.RefreshToken!,
    expiresIn: auth.ExpiresIn ?? 3600,
  };
}

/**
 * Confirm a user's email with the verification code.
 */
export async function confirmSignUp(
  email: string,
  code: string,
): Promise<void> {
  await cognito.send(
    new ConfirmSignUpCommand({
      ClientId: env.cognitoClientId,
      Username: email,
      ConfirmationCode: code,
    }),
  );
  logger.info("User email confirmed in Cognito", { email });
}

/**
 * Initiate forgot password flow.
 */
export async function forgotPassword(email: string): Promise<void> {
  await cognito.send(
    new ForgotPasswordCommand({
      ClientId: env.cognitoClientId,
      Username: email,
    }),
  );
}

/**
 * Confirm forgot password with code and new password.
 */
export async function confirmForgotPassword(
  email: string,
  code: string,
  newPassword: string,
): Promise<void> {
  await cognito.send(
    new ConfirmForgotPasswordCommand({
      ClientId: env.cognitoClientId,
      Username: email,
      ConfirmationCode: code,
      Password: newPassword,
    }),
  );
}

/**
 * Refresh an access token.
 */
export async function refreshToken(token: string): Promise<{
  accessToken: string;
  idToken: string;
  expiresIn: number;
}> {
  const result = await cognito.send(
    new InitiateAuthCommand({
      ClientId: env.cognitoClientId,
      AuthFlow: "REFRESH_TOKEN_AUTH",
      AuthParameters: {
        REFRESH_TOKEN: token,
      },
    }),
  );

  const auth = result.AuthenticationResult!;
  return {
    accessToken: auth.AccessToken!,
    idToken: auth.IdToken!,
    expiresIn: auth.ExpiresIn ?? 3600,
  };
}

/**
 * Sign out user from all devices.
 */
export async function signOut(accessToken: string): Promise<void> {
  await cognito.send(
    new GlobalSignOutCommand({ AccessToken: accessToken }),
  );
}

/**
 * Check if Cognito user pool is reachable (for health checks).
 */
export async function checkAuthHealth(): Promise<boolean> {
  if (!env.cognitoUserPoolId) return false;
  try {
    await cognito.send(
      new DescribeUserPoolCommand({
        UserPoolId: env.cognitoUserPoolId,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export { cognito as cognitoClient };
