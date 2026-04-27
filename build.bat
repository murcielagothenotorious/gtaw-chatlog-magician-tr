@echo off
echo Building and Obfuscating Project...
node build-obfuscate.js
exit /b %errorlevel%

