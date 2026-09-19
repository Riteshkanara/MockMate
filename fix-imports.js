const fs = require('fs');
const path = require('path');

const rootDir = 'C:\\Users\\DELL\\Downloads\\MockMate\\client\\src';

function getAllFiles(dir) {
  const files = [];
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath).forEach(f => files.push(f));
    } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
      files.push(fullPath);
    }
  });
  return files;
}

const files = getAllFiles(rootDir);
let totalFixed = 0;

files.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Fix Services imports based on which subfolder the file lives in
  const rel = path.relative(rootDir, filePath).replace(/\\/g, '/');
  const depth = rel.split('/').length - 1;
  const prefix = depth === 1 ? '..' : '../..';

  // Fix any broken ../services or ../../services pointing to wrong depth
  content = content.replace(
    /from (['"]).{0,10}[Ss]ervices\/interviewService\1/g,
    `from '${prefix}/Services/interviewService'`
  );
  content = content.replace(
    /from (['"]).{0,10}[Ss]ervices\/profileServices\1/g,
    `from '${prefix}/Services/profileServices'`
  );

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log('Fixed: ' + path.relative(rootDir, filePath));
    totalFixed++;
  }
});

console.log('\nTotal files fixed: ' + totalFixed);
