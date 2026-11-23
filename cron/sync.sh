#!/bin/sh
APP="/home/u244211971/domains/api.sunsetimportados.com.br/hbuilds/current/nodejs"
cd "$APP" || exit 1
exec /opt/alt/alt-nodejs24/root/bin/node --env-file="../../config/.env" dist/scripts/sync-all.js
