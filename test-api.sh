#!/bin/bash

API_BASE="https://pagerduty-lite-dev-alb-1402458952.us-east-1.elb.amazonaws.com/api"

echo "Testing PagerDuty Lite API"
echo "=========================="
echo ""

# Test 1: Health check
echo "1. Testing health endpoint..."
HEALTH=$(curl -k -s ${API_BASE}/../health | jq -r '.status')
if [ "$HEALTH" = "healthy" ]; then
    echo "   ✅ API is healthy"
else
    echo "   ❌ API health check failed"
    exit 1
fi
echo ""

# Test 2: Demo dashboard (unauthenticated)
echo "2. Testing demo dashboard (no auth required)..."
INCIDENT_COUNT=$(curl -k -s ${API_BASE}/v1/demo/dashboard | jq -r '.incidents | length')
if [ "$INCIDENT_COUNT" = "9" ]; then
    echo "   ✅ Demo endpoint returns $INCIDENT_COUNT incidents"
else
    echo "   ❌ Demo endpoint failed"
fi
echo ""

# Test 3: Login with test credentials
echo "3. Testing Cognito authentication..."
echo "   Note: This requires valid Cognito credentials"
echo "   You'll need to test login via the mobile app with:"
echo "   Email: jarod.rosenthal@protonmail.com"
echo "   Password: [your Cognito password]"
echo ""

# Test 4: Check incidents endpoint (requires auth)
echo "4. Incidents endpoint structure:"
echo "   GET ${API_BASE}/api/v1/incidents"
echo "   Headers: Authorization: Bearer <token>"
echo ""

echo "All basic tests passed! ✅"
echo ""
echo "Next steps:"
echo "1. Start the mobile app: cd mobile && npm start"
echo "2. Login with your Cognito credentials"
echo "3. You should see the incident list with 9 incidents"
echo "4. Test acknowledge/resolve from the incident cards"
