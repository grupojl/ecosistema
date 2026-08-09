const nodeExternals = require('webpack-node-externals');

module.exports = function (options) {
  return {
    ...options,
    externals: [
      nodeExternals({
        // Incluir paquetes @real/* en el bundle.
        // Sin esto Node.js no puede resolver @real/auth-server en runtime
        // porque el symlink del workspace no existe en la imagen Docker.
        allowlist: [/@real\//],
      }),
    ],
  };
};
