FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache libreoffice fontconfig ttf-dejavu postgresql16-client tar

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p /app/uploads /app/keys \
  && chown -R node:node /app

USER node

EXPOSE 5000

CMD ["node", "src/server.js"]
