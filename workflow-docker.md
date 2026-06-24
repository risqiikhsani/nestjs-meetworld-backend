# how to update container

    docker compose up -d --build

# how to update container (with docker command)

## 1. Build the new image with a tag (e.g., meetworld-backend)
docker build -t meetworld-backend .

## 2. Stop the old running container
docker stop meetworld-api-container

## 3. Remove the old container
docker rm meetworld-api-container

## 4. Start a new container using the updated image
docker run -d --name meetworld-api-container -p 3000:3000 meetworld-backend

# how to upload to dockerhub

## tag the container
docker tag yourcontainername risqiikhsani/meetworld-backend:latest

## push
docker push risqiikhsani/meetworld-backend:latest