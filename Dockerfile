# Use nginx as the base image
FROM nginx:alpine

# Copy the HTML file and JavaScript file to nginx's default serving directory
COPY index.html /usr/share/nginx/html/
COPY game.js /usr/share/nginx/html/

# Copy the characters folder
COPY characters/ /usr/share/nginx/html/characters/

# Expose port 80
EXPOSE 7070

# Nginx will start automatically, no need for CMD