#!/bin/bash
# Variable initialization
OTP=""
VERBOSE=false

# Clean up npm environment variables that cause warnings
unset npm_config_version_commit_hooks
unset npm_config_version_tag_prefix  
unset npm_config_version_git_message
unset npm_config_argv
unset npm_config_version_git_tag

# Force npm registry configuration
export NPM_CONFIG_REGISTRY="https://registry.npmjs.org/"

# Check npm authentication and registry
echo "🔍 Checking npm configuration..."

# Force npm to use the correct registry
npm config set registry https://registry.npmjs.org/ --location=user

echo "Registry: $(npm config get registry)"
echo "Current npm user: $(npm whoami --registry=https://registry.npmjs.org/ 2>/dev/null || echo 'Not logged in')"

# Usage function
usage() {
  echo "Usage: $0 --otp YOUR_OTP [--verbose]"
  echo "  --otp YOUR_OTP    Two-factor authentication OTP (required)"
  echo "  --verbose         Enable verbose output for debugging"
  echo ""
  echo "Example: $0 --otp 123456"
  echo "Example: $0 --otp 123456 --verbose"
  exit 1
}

# Argument parsing
while getopts ":-:" opt; do
  case ${opt} in
    -)
      case "${OPTARG}" in
        otp)
          OTP="${!OPTIND}"
          OPTIND=$(($OPTIND + 1))
          ;;
        verbose)
          VERBOSE=true
          ;;
        *)
          echo "Invalid option: --${OPTARG}" >&2
          usage
          ;;
      esac
      ;;
    *)
      usage
      ;;
  esac
done

# Validate OTP
if [ -z "$OTP" ]; then
  echo "❌ Error: OTP is required"
  usage
fi

# Enable debug mode if verbose
if [ "$VERBOSE" = true ]; then
  set -x
fi

# Build the project
echo "🔨 Building project..."
yarn build
if [ $? -ne 0 ]; then
  echo "❌ Build failed"
  exit 1
fi

# Update version before publishing
echo "📦 Updating version..."
node update-version.js
if [ $? -ne 0 ]; then
  echo "❌ Version update failed"
  exit 1
fi

# Commit version bump
CURRENT_VERSION=$(node -e "console.log(require('./package.json').version)")
echo "📝 Committing version bump to $CURRENT_VERSION..."
git add package.json
git commit -m "Release v$CURRENT_VERSION" || true

# Create git tag
echo "🏷️  Creating git tag..."
git tag -a "v$CURRENT_VERSION" -m "Release v$CURRENT_VERSION" || true

# Publish to npm with OTP
echo "🚀 Publishing to npm..."
npm publish --otp="$OTP"
if [ $? -ne 0 ]; then
  echo "❌ Publishing failed"
  exit 1
fi

# Push git changes
echo "📤 Pushing changes to git..."
git push
git push --tags

echo "✅ Release complete! Version: $CURRENT_VERSION"
