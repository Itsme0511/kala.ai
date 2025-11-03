// Get API URL from environment variable or default to localhost
// IMPORTANT: Set EXPO_PUBLIC_API_URL before running expo start
// Example: $env:EXPO_PUBLIC_API_URL='http://192.168.1.100:4000'
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

// Debug: Log the API URL being used (will show in Metro bundler console)
if (__DEV__) {
  console.log('🔗 API Base URL:', API_BASE_URL);
}

export { API_BASE_URL };


