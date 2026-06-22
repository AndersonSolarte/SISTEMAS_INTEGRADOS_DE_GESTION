FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache libreoffice fontconfig ttf-dejavu

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p /app/uploads /app/keys

EXPOSE 5000

CMD ["node", "src/server.js"]
