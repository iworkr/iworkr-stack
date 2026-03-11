#!/bin/bash
# Flutter App Screenshot Automation
# Uses deep links to navigate and xcrun simctl to capture

DEVICE_ID="DAF7ABD6-1047-4855-AB0F-987E6C5164B4"
DIR="/Users/tlenterprises/Development/STACK/iWorkr-Linear/screenshots/flutter"
WAIT=4  # seconds to wait after navigation for screen to render

take_screenshot() {
  local name="$1"
  sleep $WAIT
  xcrun simctl io "$DEVICE_ID" screenshot "$DIR/$name" 2>/dev/null
  echo "✓ $name"
}

navigate() {
  local url="$1"
  xcrun simctl openurl "$DEVICE_ID" "$url" 2>/dev/null
}

echo "=== iWorkr Flutter Screenshot Automation ==="
echo "Device: iPhone 16 Pro ($DEVICE_ID)"
echo "Output: $DIR"
echo ""

# The app should already be running. 
# We'll use the iworkr:// deep link scheme and also direct URLs.

# 01 - Login Screen (already captured)
echo "01 - Login screen already captured"

# Now we need to log in first. The user should already be logged in from the app session.
# Let's navigate via deep links to each screen.

# Dashboard / Home
navigate "iworkr://widget/dashboard"
take_screenshot "02-dashboard-home.png"

# Jobs list
navigate "iworkr://jobs"
sleep 1
xcrun simctl openurl "$DEVICE_ID" "iworkr://widget/dashboard" 2>/dev/null
sleep 2

echo ""
echo "=== Using simctl tap coordinates for bottom nav ==="

# The bottom nav dock is at the bottom of the screen
# iPhone 16 Pro resolution: 393x852 points (1179x2556 px @3x)
# Dock tabs approximate positions (in points):
# Tab 1 (Home): x=45, y=830
# Tab 2 (Jobs): x=125, y=830  
# Tab 3 (Schedule): x=210, y=830
# Tab 4 (Comms): x=290, y=830
# Tab 5 (Profile): x=370, y=830

echo "Done with deep link screenshots. Moving to simctl-based approach."
echo ""

echo "=== All screenshots saved to $DIR ==="
ls -la "$DIR"/*.png 2>/dev/null | wc -l
echo " screenshots total"
