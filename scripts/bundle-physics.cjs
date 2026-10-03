const fs = require('fs'), path = require('path'), esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
esbuild.buildSync({
  entryPoints: [path.join(path.dirname(require.resolve('cannon-es')), 'cannon-es.js')], outfile: path.join(root, 'src/physics.js'),
  bundle: true, format: 'iife', globalName: 'WaterPhysics', platform: 'browser',
  target: ['es2017','chrome61'], minify: true, legalComments: 'none',
  banner: {js: fs.readFileSync(path.join(path.dirname(require.resolve('cannon-es')), '../LICENSE'), 'utf8')},
  footer: {js: 'if(typeof module!=="undefined"&&module.exports)module.exports=WaterPhysics;'}
});
