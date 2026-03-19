const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src', 'app', 'dashboard');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  content = content.replace(/bg-\[#fbfbfa\]/g, 'bg-gray-50');
  content = content.replace(/hover:bg-\[#fbfbfa\]/g, 'hover:bg-gray-50');
  content = content.replace(/bg-\[#f7f7f5\]/g, 'bg-gray-50');
  content = content.replace(/hover:bg-\[#f7f7f5\]/g, 'hover:bg-gray-50');
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

function traverseDirectory(dir) {
  const list = fs.readdirSync(dir);
  list.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      traverseDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx')) {
      replaceInFile(fullPath);
    }
  });
}

traverseDirectory(directoryPath);
console.log("Done replacing hex colors.");
