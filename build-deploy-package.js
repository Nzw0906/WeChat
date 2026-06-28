import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 需要包含在部署包中的文件和目录
const filesToInclude = [
  'server.ts',
  'dist',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  '.env.example',
  'DEPLOY.md',
  'src',
];

console.log('正在准备部署包...\n');

// 检查文件是否存在
console.log('检查文件:');
filesToInclude.forEach(file => {
  const fullPath = path.join(__dirname, file);
  const exists = fs.existsSync(fullPath);
  console.log(`  ${file}: ${exists ? '✓ 存在' : '✗ 不存在'}`);
  if (!exists) {
    console.error(`错误: 缺少必要文件 ${file}`);
    process.exit(1);
  }
});

console.log('\n所有文件检查通过！');
console.log('\n部署包包含:');
filesToInclude.forEach(file => console.log(`  - ${file}`));

console.log('\n现在你可以手动打包这些文件，或者使用以下命令:');
console.log('Linux/macOS:');
console.log('  tar -czf server-deploy.tar.gz ' + filesToInclude.join(' '));
console.log('\nWindows (PowerShell):');
console.log('  Compress-Archive -Path ' + filesToInclude.join(',') + ' -DestinationPath server-deploy.zip');
console.log('\nWindows (使用 7-Zip):');
console.log('  7z a server-deploy.zip ' + filesToInclude.join(' '));
