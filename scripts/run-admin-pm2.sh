FREEFALL_PORT=3005 \
FREEFALL_LOG_LEVEL=DEBUG \
PGUSER=freefall \
PGPASSWORD=freefall \
PGDATABASE=freefall \
pm2 start ./admin.js -i max
