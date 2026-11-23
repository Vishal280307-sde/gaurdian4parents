FROM node:22-alpine

WORKDIR /app

# Install build dependencies
COPY package.json ./

# Install dependencies
RUN npm install

# Copy project files
COPY . .

# Build client and server
RUN npm run build

# Expose port
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV ENABLE_DEMO_ACCOUNTS=true

CMD ["npm", "start"]
