const fs = require('fs-extra');
const path = require('path');

const distPath = path.resolve(__dirname, '..', 'dist');

if (fs.existsSync(distPath)) {
  fs.emptyDirSync(distPath);
  console.log('Dist folder cleaned.');
} else {
  fs.ensureDirSync(distPath);
  console.log('Dist folder was missing, created.');
}