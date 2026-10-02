FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/app/data \
    STATIC_DIR=/app/public \
    NODE_NO_WARNINGS=1
COPY server/server.js ./server.js
COPY index.html ./public/
COPY css ./public/css
COPY js ./public/js
COPY assets ./public/assets
EXPOSE 8080
CMD ["node", "server.js"]
