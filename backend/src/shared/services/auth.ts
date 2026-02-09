import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { config } from "../config/index.js";

const cognito = new CognitoIdentityProviderClient({ region: config.aws.region });

export async function createCognitoUser(
  email: string,
  password: string,
): Promise<string | undefined> {
  const createResult = await cognito.send(
    new AdminCreateUserCommand({
      UserPoolId: config.aws.cognito.userPoolId,
      Username: email,
      UserAttributes: [
        { Name: "email", Value: email },
        { Name: "email_verified", Value: "true" },
      ],
      MessageAction: "SUPPRESS",
    }),
  );

  await cognito.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: config.aws.cognito.userPoolId,
      Username: email,
      Password: password,
      Permanent: true,
    }),
  );

  return createResult.User?.Username;
}

export async function authenticateCognitoUser(
  email: string,
  password: string,
) {
  const result = await cognito.send(
    new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: config.aws.cognito.clientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    }),
  );

  return result.AuthenticationResult;
}
