import 'dotenv/config';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminGetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { createDataSource } from '../src/shared/db/data-source';
import { User } from '../src/shared/models/User';
import { logger } from '../src/shared/utils/logger';

const ORG_ID = '11111111-1111-1111-1111-111111111111';
const PASSWORD = 'REDACTED_DEMO_PASSWORD';

const usersToAdd = [
  { email: 'alice.jones@contoso.com', fullName: 'Alice Jones' },
  { email: 'bob.smith@contoso.com', fullName: 'Bob Smith' },
  { email: 'admin@oncallshift.com', fullName: 'Jarod Rosenthal' },
];

const cognitoClient = new CognitoIdentityProviderClient({
  region: 'us-east-1',
});

async function addAdminUsers() {
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  if (!userPoolId) {
    throw new Error('COGNITO_USER_POOL_ID not set');
  }

  logger.info('Starting admin user creation...', { userPoolId });

  const dataSource = await createDataSource();
  await dataSource.initialize();
  const userRepo = dataSource.getRepository(User);

  for (const { email, fullName } of usersToAdd) {
    try {
      logger.info(`Processing user: ${email}`);

      // Check if user already exists in database
      let user = await userRepo.findOne({ where: { email } });
      let cognitoSub: string;

      if (user) {
        logger.info(`User ${email} already exists in database, updating role to admin`);
        user.role = 'admin';
        await userRepo.save(user);
        cognitoSub = user.cognitoSub;
      } else {
        // Try to get existing Cognito user first
        try {
          const existingCognitoUser = await cognitoClient.send(
            new AdminGetUserCommand({
              UserPoolId: userPoolId,
              Username: email,
            })
          );
          cognitoSub = existingCognitoUser.Username || email;
          logger.info(`Found existing Cognito user: ${cognitoSub}`);
        } catch (getUserError: any) {
          if (getUserError.name === 'UserNotFoundException') {
            // Create new Cognito user
            logger.info(`Creating Cognito user: ${email}`);
            const createResult = await cognitoClient.send(
              new AdminCreateUserCommand({
                UserPoolId: userPoolId,
                Username: email,
                UserAttributes: [
                  { Name: 'email', Value: email },
                  { Name: 'email_verified', Value: 'true' },
                  { Name: 'name', Value: fullName },
                ],
                MessageAction: 'SUPPRESS', // Don't send welcome email
              })
            );
            cognitoSub = createResult.User?.Username || email;
            logger.info(`Created Cognito user: ${cognitoSub}`);
          } else {
            throw getUserError;
          }
        }

        // Create user in database
        user = userRepo.create({
          email,
          cognitoSub,
          fullName,
          orgId: ORG_ID,
          role: 'admin',
          status: 'active',
        });
        await userRepo.save(user);
        logger.info(`Created database user: ${user.id}`);
      }

      // Set the password permanently
      logger.info(`Setting password for: ${email}`);
      await cognitoClient.send(
        new AdminSetUserPasswordCommand({
          UserPoolId: userPoolId,
          Username: email,
          Password: PASSWORD,
          Permanent: true,
        })
      );
      logger.info(`Password set successfully for: ${email}`);

      logger.info(`✅ Successfully processed: ${email} (role: admin)`);
    } catch (error: any) {
      logger.error(`Failed to process ${email}:`, error);
    }
  }

  await dataSource.destroy();
  logger.info('Done adding admin users!');
}

addAdminUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });
