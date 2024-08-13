@echo off
echo Running type-builder.js...
node type-builder.js
if %errorlevel% neq 0 (
    echo type-builder.js encountered an error. Exiting...
    exit /b %errorlevel%
)

echo Running swagger-builder.ts...
npx ts-node swagger-builder.ts -baseUrl @services/baseUrl
if %errorlevel% neq 0 (
    echo swagger-builder.ts encountered an error. Exiting...
    exit /b %errorlevel%
)

echo All scripts ran successfully!
pause
