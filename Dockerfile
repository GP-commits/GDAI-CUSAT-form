FROM node:22-alpine

# Create app directory
WORKDIR /app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

RUN npm ci --only=production

# Bundle app source
COPY . .

# Ensure the data directory exists and has the right permissions
RUN mkdir -p /app/data && chown -R node:node /app/data

# Use a non-root user for security
USER node

EXPOSE 3000

CMD ["npm", "start"]
