const fs = require('fs');
const path = require('path');

const getSSLOptions = () => {
  const keyPath = process.env.SSL_KEY_PATH;
  const certPath = process.env.SSL_CERT_PATH;

  if (!keyPath || !certPath) {
    return null;
  }

  try {
    return {
      key: fs.readFileSync(path.resolve(keyPath)),
      cert: fs.readFileSync(path.resolve(certPath))
    };
  } catch (error) {
    console.error('SSL certificate error:', error.message);
    return null;
  }
};

module.exports = { getSSLOptions };