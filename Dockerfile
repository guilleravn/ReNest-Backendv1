# Local development / e2e image: builds the API so it can run in docker-compose
# alongside Postgres, mainly so ReNest-Frontend can run its e2e suite against a
# real backend instead of mocks. No production target has been decided yet
# (see docs/architecture.md), so this is not tuned for a prod deploy.
FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run prisma:generate
RUN npm run build

EXPOSE 3000

# The seed is opt-in (SEED_ON_START=true, set only by docker-compose.yml for local/e2e): any other
# environment built from this image must never create the accounts with the shared seed password.
CMD ["sh", "-c", "npm run prisma:deploy && if [ \"$SEED_ON_START\" = 'true' ]; then npm run db:seed; fi && npm run start:prod"]
