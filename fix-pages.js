const fs = require('fs');
const path = require('path');

const rootDir = 'C:\\Users\\DELL\\Downloads\\MockMate\\client\\src';

const pageFixes = [
  { file: 'pages\\Interview.jsx',   pattern: /from (["'])\.\/interview\//g,   replace: "from $1../components/interview/" },
  { file: 'pages\\Dashboard.jsx',   pattern: /from (["'])\.\/dashboard\//g,   replace: "from $1../components/dashboard/" },
  { file: 'pages\\Analytics.jsx',   pattern: /from (["'])\.\/analytics\//g,   replace: "from $1../components/analytics/" },
  { file: 'pages\\Result.jsx',      pattern: /from (["'])\.\/result\//g,      replace: "from $1../components/result/" },
  { file: 'pages\\Leaderboard.jsx', pattern: /from (["'])\.\/leaderboard\//g, replace: "from $1../components/leaderboard/" },
  { file: 'pages\\Coach.jsx',       pattern: /from (["'])\.\/coach\//g,       replace: "from $1../components/coach/" },
];

let totalFixed = 0;

pageFixes.forEach(({ file, pattern, replace }) => {
  const fullPath = path.join(rootDir, file);
  if (!fs.existsSync(fullPath)) { console.log('SKIP: ' + file); return; }
  let content = fs.readFileSync(fullPath, 'utf8');
  const original = content;
  content = content.replace(pattern, replace);
  if (content !== original) {
    fs.writeFileSync(fullPath, content);
    console.log('Fixed: ' + file);
    totalFixed++;
  }
});

console.log('\nTotal fixed: ' + totalFixed);
