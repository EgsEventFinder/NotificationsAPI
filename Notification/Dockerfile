# Use an official Node.js runtime as a parent image
FROM node:14

# Set the working directory to /app
WORKDIR /app

# Copy the current directory contents into the container at /app
COPY . /app

# Install any needed packages
RUN npm install

# Expose the port
EXPOSE 3003

# Define the command to run the app
CMD ["npm", "start"]
