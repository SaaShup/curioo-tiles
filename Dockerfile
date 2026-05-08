FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV ALLOWED_EDITOR_EMAILS=""
ENV KEYCLOAK_REALM="curioo"
ENV KEYCLOAK_URL="https://connect.curioo.city"
ENV KEYCLOAK_SSL_REQUIRED="external"
ENV KEYCLOAK_CLIENT_ID="tilemap"
ENV KEYCLOAK_CLIENT_SECRET="curioocity"
ENV KEYCLOAK_CONFIDENTIAL_PORT=0

COPY package*.json ./
RUN npm install --production

COPY . .

RUN mkdir -p cache

EXPOSE 3000

CMD ["node", "server.js"]
