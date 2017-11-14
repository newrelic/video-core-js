#!/bin/bash -e

npm install --verbose
npm test --verbose
if [ $? -eq 0 ]; then
npm run build
npm install aws-sdk # needed for deploying
npm run deploy
fi