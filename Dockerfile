FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

RUN mkdir -p cache

EXPOSE 3000

CMD ["node", "server.js"]
