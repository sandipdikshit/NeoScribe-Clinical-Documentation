# Use the official Node.js image from the Docker Hub.
FROM node:22.14.0-alpine

# Set the working directory in the container
WORKDIR /src

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Expose the port your app will run on
EXPOSE 3000

# Start the application
CMD ["npm", "run" , "start"]
