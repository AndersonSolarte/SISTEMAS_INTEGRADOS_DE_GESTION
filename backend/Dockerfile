FROM node:24-alpine3.22

WORKDIR /app

RUN apk add --no-cache libreoffice fontconfig ttf-dejavu postgresql16-client tar poppler-utils

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY templates ./templates

RUN mkdir -p /app/uploads /app/keys \
  && chown -R node:node /app

USER node

EXPOSE 5000

CMD ["node", "src/server.js"]
