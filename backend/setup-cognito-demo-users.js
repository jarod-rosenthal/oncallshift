const {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  ListUsersCommand
} = require('@aws-sdk/client-cognito-identity-provider');

const DEMO_PASSWORD = 'Password123$$$';
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || 'us-east-1_vMk9CQycK';

// This will be populated from the real user
const ORG_ID = '11111111-1111-1111-1111-111111111111';

async function setupCognitoUsers() {
  const cognitoClient = new CognitoIdentityProviderClient({ region: 'us-east-1' });

  const demoUsers = [
    {
      email: 'alice.jones@contoso.com',
      fullName: 'Alice Jones',
    },
    {
      email: 'bob.smith@contoso.com',
      fullName: 'Bob Smith',
    }
  ];

  console.log('🔐 Setting up Cognito demo users...\n');

  for (const user of demoUsers) {
    console.log(`📧 Processing ${user.email}...`);

    try {
      // Try to create the user
      const createUserCommand = new AdminCreateUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: user.email,
        UserAttributes: [
          { Name: 'email', Value: user.email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'name', Value: user.fullName },
          { Name: 'custom:org_id', Value: ORG_ID },
        ],
        MessageAction: 'SUPPRESS',
      });

      const createResult = await cognitoClient.send(createUserCommand);
      console.log(`  ✅ Created Cognito user`);
      console.log(`  📝 Cognito Sub: ${createResult.User.Username}`);

    } catch (error) {
      if (error.name === 'UsernameExistsException') {
        console.log(`  ⚠️  User already exists in Cognito`);
      } else {
        console.error(`  ❌ Error creating user:`, error.message);
        continue;
      }
    }

    // Set password (works for both new and existing users)
    try {
      const setPasswordCommand = new AdminSetUserPasswordCommand({
        UserPoolId: USER_POOL_ID,
        Username: user.email,
        Password: DEMO_PASSWORD,
        Permanent: true,
      });

      await cognitoClient.send(setPasswordCommand);
      console.log(`  ✅ Password set to: ${DEMO_PASSWORD}`);
    } catch (error) {
      console.error(`  ❌ Error setting password:`, error.message);
    }

    console.log('');
  }

  console.log('✨ Cognito setup complete!\n');
  console.log('📋 Login credentials:');
  console.log('  alice.jones@contoso.com / Password123$$$');
  console.log('  bob.smith@contoso.com / Password123$$$');
  console.log('\nℹ️  Database records will be created automatically on first login');
}

setupCognitoUsers()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
