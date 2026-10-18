const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4173', locale: 'es-UY', timezoneId: 'America/Montevideo' },
  webServer: {
    command: 'python3 -m http.server 4173 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4173/index.html',
    reuseExistingServer: true,
    stdout: 'ignore',
    stderr: 'ignore'
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }]
});
