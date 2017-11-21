#!/bin/bash -e

npm install --verbose
npm test --verbose
if [ $? -eq 0 ]; then
npm run build
npm run deploy $1 #deploy mode: version, lastbuild...
fi