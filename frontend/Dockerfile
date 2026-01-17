# Use Node 20 Alpine as base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port 80
EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]