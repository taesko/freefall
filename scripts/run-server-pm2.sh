FREEFALL_PORT=3000 \
FREEFALL_LOG_LEVEL=DEBUG \
PGUSER=freefall \
PGPASSWORD=freefall \
PGDATABASE=freefall \
pm2 start ./server.js -i max

