# HDL SmartBus Homey App - Testing

This directory contains tests for the HDL SmartBus Homey app.

## Setup

Install dependencies including Jest:

```bash
npm install
```

## Running Tests

Run all tests:

```bash
npm test
```

Run tests in watch mode (automatically rerun on file changes):

```bash
npm run test:watch
```

Run tests with coverage report:

```bash
npm run test:coverage
```

## Test Structure

Tests are organized by component:

- `app.test.js` - Tests for main app logic, validation, and configuration
- `hdl_devicelist.test.js` - Tests for device type mapping
- `mocks/homey.js` - Mock Homey SDK for testing without a real Homey

## Writing New Tests

When adding new functionality, please add corresponding tests. Follow the existing patterns:

1. **Test critical business logic** - validation, data transformations, state management
2. **Mock external dependencies** - Use the Homey mock for SDK interactions
3. **Test edge cases** - invalid input, boundary conditions, error handling
4. **Keep tests isolated** - Each test should be independent and runnable on its own

### Example Test

```javascript
describe('MyFeature', () => {
  let instance;

  beforeEach(() => {
    instance = new MyFeature();
  });

  test('should handle normal case', () => {
    const result = instance.doSomething('valid input');
    expect(result).toBe(expectedValue);
  });

  test('should handle edge case', () => {
    expect(() => instance.doSomething(null)).toThrow();
  });
});
```

## What to Test

### Priority 1: Critical Paths
- Device validation logic
- Signal parsing and routing
- Command encoding/decoding
- Error handling

### Priority 2: Business Logic
- Device state management
- Capability mappings
- Driver operations

### Priority 3: Edge Cases
- Invalid inputs
- Missing data
- Network failures
- Protocol edge cases

## Mocking Homey SDK

Since Homey apps require the Homey SDK and hardware, we mock the SDK for testing. The mock (`mocks/homey.js`) provides:

- Mock App, Device, Driver classes
- Mock settings manager
- Mock drivers manager
- Mock logging

When you need new mock functionality, add it to `mocks/homey.js`.

## Continuous Integration

Tests are configured to run on:
- Pull requests
- Before releases
- On code changes

See `.github/workflows/` for CI configuration.

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Homey SDK Reference](https://apps-sdk-v3.developer.homey.app/)
- [Community Forum](https://community.homey.app)

