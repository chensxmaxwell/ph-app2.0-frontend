const fs = require('fs');
const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);
const { assetExts, sourceExts } = defaultConfig.resolver;
const engineDir = path.resolve(__dirname, 'assets/avatar-engine');

const ENGINE_FILES = {
  '/ph-avatar/viewer.html': ['viewer-page.html', 'text/html; charset=utf-8'],
  '/ph-avatar/three.min.js': ['three.min.js', 'application/javascript'],
  '/ph-avatar/GLTFLoader.js': ['GLTFLoader.js', 'application/javascript'],
  '/bozo-male.glb': ['bozo-male.glb', 'model/gltf-binary'],
  '/ph-avatar/bozo-male.glb': ['bozo-male.glb', 'model/gltf-binary'],
  '/parametric-base.glb': ['bozo-male.glb', 'model/gltf-binary'],
  '/ph-avatar/parametric-base.glb': ['bozo-male.glb', 'model/gltf-binary'],
};

const { startAvatarStaticServer } = require('./scripts/avatar-static-server');
startAvatarStaticServer();

const previousEnhance =
  defaultConfig.server && defaultConfig.server.enhanceMiddleware;

const config = {
  transformer: {
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
  },
  resolver: {
    assetExts: [
      ...new Set([...assetExts.filter(ext => ext !== 'svg'), 'glb', 'txt']),
    ],
    sourceExts: [...sourceExts, 'svg'],
  },
  server: {
    enhanceMiddleware: (metroMiddleware, metroServer) => {
      const inner = previousEnhance
        ? previousEnhance(metroMiddleware, metroServer)
        : metroMiddleware;
      return (req, res, next) => {
        const urlPath = (req.url || '').split('?')[0];
        const mapped = ENGINE_FILES[urlPath];
        if (mapped) {
          const [fileName, contentType] = mapped;
          const filePath = path.join(engineDir, fileName);
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'no-store');
          fs.createReadStream(filePath).on('error', next).pipe(res);
          return;
        }
        return inner(req, res, next);
      };
    },
  },
};

module.exports = mergeConfig(defaultConfig, config);
