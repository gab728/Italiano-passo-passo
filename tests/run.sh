#!/bin/sh
# Lance le serveur de test, puis les parcours Chromium. Usage : sh tests/run.sh
cd "$(dirname "$0")/.." || exit 1
node scripts/build.mjs || exit 1
node --experimental-strip-types --no-warnings tests/mock-server.mjs 8787 > /tmp/ipp-mock.log 2>&1 &
PID=$!
sleep 1.5
node tests/unit.cjs || exit 1
node tests/check-he.mjs > /tmp/ipp-check-he.log || { cat /tmp/ipp-check-he.log; exit 1; }
node tests/check-es.mjs > /tmp/ipp-check-es.log || { cat /tmp/ipp-check-es.log; exit 1; }
node tests/check-fr.mjs > /tmp/ipp-check-fr.log || { cat /tmp/ipp-check-fr.log; exit 1; }
node tests/check-en.mjs > /tmp/ipp-check-en.log || { cat /tmp/ipp-check-en.log; exit 1; }
node tests/check-i18n.mjs > /tmp/ipp-check-i18n.log || { grep ERREUR /tmp/ipp-check-i18n.log; exit 1; }
NODE_PATH=${NODE_PATH:-/opt/npm-tools/node_modules} node tests/e2e.cjs; R1=$?
NODE_PATH=${NODE_PATH:-/opt/npm-tools/node_modules} node tests/stt.cjs; R2=$?
NODE_PATH=${NODE_PATH:-/opt/npm-tools/node_modules} node tests/voices.cjs; R3=$?
NODE_PATH=${NODE_PATH:-/opt/npm-tools/node_modules} node tests/hebrew.cjs; R4=$?
NODE_PATH=${NODE_PATH:-/opt/npm-tools/node_modules} node tests/talk.cjs; R5=$?
NODE_PATH=${NODE_PATH:-/opt/npm-tools/node_modules} node tests/train.cjs; R6=$?
NODE_PATH=${NODE_PATH:-/opt/npm-tools/node_modules} node tests/spanish.cjs; R7=$?
NODE_PATH=${NODE_PATH:-/opt/npm-tools/node_modules} node tests/i18n.cjs; R8=$?
NODE_PATH=${NODE_PATH:-/opt/npm-tools/node_modules} node tests/french.cjs; R9=$?
NODE_PATH=${NODE_PATH:-/opt/npm-tools/node_modules} node tests/english.cjs; R10=$?
node tests/premium.cjs; R11=$?
NODE_PATH=${NODE_PATH:-/opt/npm-tools/node_modules} node tests/premium-ui.cjs; R12=$?
NODE_PATH=${NODE_PATH:-/opt/npm-tools/node_modules} node tests/fx.cjs; R13=$?
NODE_PATH=${NODE_PATH:-/opt/npm-tools/node_modules} node tests/link.cjs
kill $PID
[ $R1 -eq 0 ] && [ $R2 -eq 0 ] && [ $R3 -eq 0 ] && [ $R4 -eq 0 ] && [ $R5 -eq 0 ] && [ $R6 -eq 0 ] && [ $R7 -eq 0 ] && [ $R8 -eq 0 ] && [ $R9 -eq 0 ] && [ $R10 -eq 0 ] && [ $R11 -eq 0 ] && [ $R12 -eq 0 ] && [ $R13 -eq 0 ]
