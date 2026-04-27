import fs from 'fs';
import path from 'path';
import JavaScriptObfuscator from 'javascript-obfuscator';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_DIR = path.join(__dirname, 'dist');
const DIRS_TO_COPY = ['css', 'js', 'color-palette', 'assets', 'webfonts'];
const FILES_TO_COPY = ['index.html', 'favicon.png', 'favicon1.png', 'logo.png', '_headers', '_redirects'];

console.log('--- Chatlog Magician Build Script ---');

// 1. Create dist directory
if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_DIR);

// Helper function to copy recursively
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest);
    fs.readdirSync(src).forEach(function(childItemName) {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else if (exists) {
    fs.copyFileSync(src, dest);
  }
}

// 2. Copy files and directories
console.log('Copying files to dist folder...');
DIRS_TO_COPY.forEach(dir => {
  if (fs.existsSync(dir)) copyRecursiveSync(dir, path.join(DIST_DIR, dir));
});
FILES_TO_COPY.forEach(file => {
  if (fs.existsSync(file)) fs.copyFileSync(file, path.join(DIST_DIR, file));
});

// 3. Obfuscate JS files in dist directory
console.log('Obfuscating JavaScript files...');

function obfuscateFilesInDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      obfuscateFilesInDir(filePath);
    } else if (filePath.endsWith('.js')) {
      console.log(`Locking down: ${file}`);
      const code = fs.readFileSync(filePath, 'utf8');
      
      const obfuscationResult = JavaScriptObfuscator.obfuscate(code, {
          compact: true,
          controlFlowFlattening: true,
          controlFlowFlatteningThreshold: 0.75,
          deadCodeInjection: true,
          deadCodeInjectionThreshold: 0.4,
          debugProtection: false,
          disableConsoleOutput: false,
          identifierNamesGenerator: 'hexadecimal',
          log: false,
          renameGlobals: false,
          rotateStringArray: true,
          selfDefending: true,
          stringArray: true,
          stringArrayEncoding: ['base64'],
          stringArrayThreshold: 0.75,
          unicodeEscapeSequence: false
      });
      
      fs.writeFileSync(filePath, obfuscationResult.getObfuscatedCode());
    }
  }
}

obfuscateFilesInDir(path.join(DIST_DIR, 'js'));
obfuscateFilesInDir(path.join(DIST_DIR, 'color-palette'));

console.log('Build completed successfully! Everything is inside the "dist" folder.');
console.log('Set your Cloudflare Pages / Vercel build directory to "dist".');
