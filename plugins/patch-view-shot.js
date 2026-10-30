const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '..', 'node_modules', 'react-native-view-shot', 'package.json');
if (fs.existsSync(pkgPath)) {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    let modified = false;
    if (pkg['react-native'] === 'src/index.tsx') {
      pkg['react-native'] = 'lib/index.js';
      modified = true;
    }
    if (pkg.exports && pkg.exports['.'] && pkg.exports['.']['react-native'] === './src/index.tsx') {
      pkg.exports['.']['react-native'] = './lib/index.js';
      modified = true;
    }
    if (modified) {
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
      console.log('[patch-view-shot] Adjusted react-native entry point to lib/index.js');
    }
  } catch (e) {
    // ignore
  }
}

const mapPath = path.join(__dirname, '..', 'node_modules', 'react-native-view-shot', 'lib', 'index.d.ts.map');
if (fs.existsSync(mapPath)) {
  try {
    fs.unlinkSync(mapPath);
  } catch (e) {
    // ignore
  }
}
