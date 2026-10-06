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

# The seed is idempotent, so the e2e stack always has the pre-created accounts and categories.
CMD ["sh", "-c", "npm run prisma:deploy && npm run db:seed && npm run start:prod"]
