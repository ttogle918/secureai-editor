import { deriveApiGroup, deriveEndpoint } from '../vulnUtils';

describe('deriveApiGroup', () => {
  it('maps DVWA vulnerability paths to /vulnerabilities/{type}', () => {
    expect(deriveApiGroup('dvwa/vulnerabilities/sqli/index.php')).toBe('/vulnerabilities/sqli');
    expect(deriveApiGroup('vulnerabilities/xss_r/index.php')).toBe('/vulnerabilities/xss_r');
  });

  it('derives an API label from *Controller class files (with spaced PascalCase)', () => {
    expect(deriveApiGroup('src/main/java/UserController.java')).toBe('User API');
  });

  it('derives a Handler label from *Handler files', () => {
    expect(deriveApiGroup('src/PaymentHandler.go')).toBe('Payment Handler');
  });

  it('derives a Route label from *Router files', () => {
    expect(deriveApiGroup('api/AuthRouter.ts')).toBe('Auth Route');
  });

  it('falls back to the parent directory segment', () => {
    expect(deriveApiGroup('src/services/foo.py')).toBe('services');
  });

  it('normalizes Windows backslashes', () => {
    expect(deriveApiGroup('dvwa\\vulnerabilities\\sqli\\index.php')).toBe('/vulnerabilities/sqli');
  });

  it('handles a single-segment path', () => {
    expect(deriveApiGroup('foo.java')).toBe('foo.java');
  });
});

describe('deriveEndpoint', () => {
  it('builds a DVWA endpoint path', () => {
    expect(deriveEndpoint('dvwa/vulnerabilities/sqli/index.php')).toBe('/dvwa/vulnerabilities/sqli/');
    expect(deriveEndpoint('vulnerabilities/exec/index.php')).toBe('/dvwa/vulnerabilities/exec/');
  });

  it('extracts the pathname from a URL in the description', () => {
    expect(deriveEndpoint('src/Foo.java', 'see https://host.com/api/users?x=1')).toBe('/api/users');
  });

  it('extracts an endpoint hinted by endpoint/path/route keywords', () => {
    expect(deriveEndpoint('src/Foo.java', 'endpoint: /v1/orders')).toBe('/v1/orders');
  });

  it('returns empty string when nothing can be inferred', () => {
    expect(deriveEndpoint('src/Foo.java', 'no hints here')).toBe('');
    expect(deriveEndpoint('src/Foo.java')).toBe('');
  });

  it('ignores keyword matches that are not absolute paths', () => {
    expect(deriveEndpoint('src/Foo.java', 'path: relative/no/slash')).toBe('');
  });
});
