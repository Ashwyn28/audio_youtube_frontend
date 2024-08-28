# Use the official Node.js image as a base
FROM node:18-slim

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code to the container
COPY . .

# Build the SvelteKit app (optional: if you're using a static site or need to build before serving)
RUN npm run build

# Expose the port that the app will run on
EXPOSE 3000

# Start the SvelteKit app
CMD ["npm", "run", "preview"]
