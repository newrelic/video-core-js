#!/bin/bash -e

npm install --verbose
npm test --verbose
if [ $? -eq 0 ]; then
npm run build
fi