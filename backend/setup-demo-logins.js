const { Client } = require('pg');
const {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand
} = require('@aws-sdk/client-cognito-identity-provider');

const DEMO_PASSWORD = 'Password123$$$';
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;

async function setupDemoUsers() {
  // Database connection
  const dbClient = new Client({
    host: 'pagerduty-lite-dev.cn9wuodq8uyb.us-east-1.rds.amazonaws.com',
    port: 5432,
    user: 'pgadmin',
    password: '->S1YS<FM[lZ1]8((BIfWK1kahm<n6o1',
    database: 'pagerduty_lite',
    ssl: { rejectUnauthorized: false }
  });

  // Cognito client
  const cognitoClient = new CognitoIdentityProviderClient({ region: 'us-east-1' });

  try {
    console.log('Connecting to database...');
    await dbClient.connect();
    console.log('✅ Connected to database');

    // Get the organization ID
    const orgResult = await dbClient.query(`
      SELECT org_id FROM users
      WHERE email NOT IN ('alice.jones@contoso.com', 'bob.smith@contoso.com')
      LIMIT 1
    `);

    const orgId = orgResult.rows[0]?.org_id;
    if (!orgId) {
      throw new Error('No organization found in database');
    }
    console.log('Organization ID:', orgId);

    // Demo users configuration
    const demoUsers = [
      {
        email: 'alice.jones@contoso.com',
        fullName: 'Alice Jones',
        userId: 'a1111111-1111-1111-1111-111111111111',
      },
      {
        email: 'bob.smith@contoso.com',
        fullName: 'Bob Smith',
        userId: 'b2222222-2222-2222-222222222222',
      }
    ];

    for (const user of demoUsers) {
      console.log(`\n📧 Setting up ${user.email}...`);

      // Create Cognito user
      try {
        const createUserCommand = new AdminCreateUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: user.email,
          UserAttributes: [
            { Name: 'email', Value: user.email },
            { Name: 'email_verified', Value: 'true' },
            { Name: 'name', Value: user.fullName },
            { Name: 'custom:org_id', Value: orgId },
          ],
          MessageAction: 'SUPPRESS', // Don't send welcome email
        });

        const createResult = await cognitoClient.send(createUserCommand);
        const cognitoSub = createResult.User.Username;
        console.log(`  ✅ Created Cognito user (sub: ${cognitoSub})`);

        // Set permanent password
        const setPasswordCommand = new AdminSetUserPasswordCommand({
          UserPoolId: USER_POOL_ID,
          Username: user.email,
          Password: DEMO_PASSWORD,
          Permanent: true,
        });

        await cognitoClient.send(setPasswordCommand);
        console.log(`  ✅ Set password to: ${DEMO_PASSWORD}`);

        // Create or update database user
        await dbClient.query(`
          INSERT INTO users (
            id, org_id, email, cognito_sub, full_name, role, status, settings
          ) VALUES (
            $1, $2, $3, $4, $5, 'member', 'active',
            jsonb_build_object(
              'availability', jsonb_build_object(
                'timezone', 'America/New_York',
                'weeklyHours', jsonb_build_object(
                  'monday', jsonb_build_object('available', true, 'start', '00:00', 'end', '23:59'),
                  'tuesday', jsonb_build_object('available', true, 'start', '00:00', 'end', '23:59'),
                  'wednesday', jsonb_build_object('available', true, 'start', '00:00', 'end', '23:59'),
                  'thursday', jsonb_build_object('available', true, 'start', '00:00', 'end', '23:59'),
                  'friday', jsonb_build_object('available', true, 'start', '00:00', 'end', '23:59'),
                  'saturday', jsonb_build_object('available', true, 'start', '00:00', 'end', '23:59'),
                  'sunday', jsonb_build_object('available', true, 'start', '00:00', 'end', '23:59')
                ),
                'blackoutDates', '[]'::jsonb
              )
            )
          )
          ON CONFLICT (email) DO UPDATE
            SET cognito_sub = EXCLUDED.cognito_sub,
                full_name = EXCLUDED.full_name,
                org_id = EXCLUDED.org_id,
                status = 'active'
        `, [user.userId, orgId, user.email, cognitoSub, user.fullName]);

        console.log(`  ✅ Created/updated database user`);

      } catch (error) {
        if (error.name === 'UsernameExistsException') {
          console.log(`  ⚠️  Cognito user already exists`);

          // Get existing Cognito sub
          const existingUser = await dbClient.query(
            'SELECT cognito_sub FROM users WHERE email = $1',
            [user.email]
          );

          if (existingUser.rows.length > 0) {
            // Update password for existing user
            const setPasswordCommand = new AdminSetUserPasswordCommand({
              UserPoolId: USER_POOL_ID,
              Username: user.email,
              Password: DEMO_PASSWORD,
              Permanent: true,
            });

            await cognitoClient.send(setPasswordCommand);
            console.log(`  ✅ Updated password to: ${DEMO_PASSWORD}`);
          }
        } else {
          throw error;
        }
      }
    }

    console.log('\n✨ Demo users setup complete!');
    console.log('\n📋 Login credentials:');
    console.log('  Email: alice.jones@contoso.com');
    console.log(`  Password: ${DEMO_PASSWORD}`);
    console.log('\n  Email: bob.smith@contoso.com');
    console.log(`  Password: ${DEMO_PASSWORD}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await dbClient.end();
    console.log('\n🔌 Database connection closed');
  }
}

setupDemoUsers()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
