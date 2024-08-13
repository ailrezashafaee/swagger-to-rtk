#!/bin/bash

echo "Running type-builder.js..."
node type-builder.js
if [ $? -ne 0 ]; then
  echo "type-builder.js encountered an error. Exiting..."
  exit 1
fi

echo "Running swagger-builder.ts..."
npx ts-node swagger-builder.ts -baseUrl @services/baseUrl
if [ $? -ne 0 ]; then
  echo "swagger-builder.ts encountered an error. Exiting..."
  exit 1
fi

echo "All scripts ran successfully!"
