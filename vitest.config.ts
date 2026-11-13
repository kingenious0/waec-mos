const path = require('path')

module.exports = {
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    alias: {
      '@': path.resolve(__dirname),
    },
  },
}
