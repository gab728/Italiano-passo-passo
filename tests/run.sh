#!/bin/sh
# Lance le serveur de test, puis les parcours Chromium. Usage : sh tests/run.sh
cd "$(dirname "$0")/.." || exit 1
node scripts/build.mjs || exit 1
node --experimental-strip-types --no-warnings tests/mock-server.mjs 8787 > /tmp/ipp-mock.log 2>&1 &
PID=$!
sleep 1.5
node tests/unit.cjs || exit 1
NODE_PATH=${NODE_PATH:-/opt/npm-tools/node_modules} node tests/e2e.cjs; R1=$?
NODE_PATH=${NODE_PATH:-/opt/npm-tools/node_modules} node tests/stt.cjs; R2=$?
NODE_PATH=${NODE_PATH:-/opt/npm-tools/node_modules} node tests/voices.cjs; R3=$?
NODE_PATH=${NODE_PATH:-/opt/npm-tools/node_modules} node tests/link.cjs
kill $PID
[ $R1 -eq 0 ] && [ $R2 -eq 0 ] && [ $R3 -eq 0 ]
