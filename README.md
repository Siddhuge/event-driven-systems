# To start the docker compose 

cd docker
docker compose up -d

# To stop the docker compose 

docker compose down -v
docker system prune -f

# Verify containers

docker ps

# Three containers should be their 

docker-kafka-1
docker-zookeeper-1
docker-rabbitmq-1

# Create Kafka Topics

docker exec -it docker-kafka-1 kafka-topics \
--create --topic orders \
--bootstrap-server localhost:9092 \
--partitions 3 --replication-factor 1

docker exec -it docker-kafka-1 kafka-topics \
--create --topic orders_retry \
--bootstrap-server localhost:9092 \
--partitions 3 --replication-factor 1

docker exec -it docker-kafka-1 kafka-topics \
--create --topic orders_dlq \
--bootstrap-server localhost:9092 \
--partitions 3 --replication-factor 1


# Verify Topics got created or not 

docker $docker exec -it docker-kafka-1 kafka-topics \
--list \
--bootstrap-server localhost:9092
orders
orders_dlq
orders_retry

# Start Services For best visibility start 3 terminals

# Terminal 1 -- Inventory Service

cd services/inventory-service
npm install
node server.js


---  Inventory Consumer Running...

# Terminal 2 -- Retry Worker

cd services/inventory-service/src/rabbitmq
node retryConsumer.js

--- Retry Worker Running...

# Terminal 3 -- Order Service

cd services/order-service
npm install
node server.js

--- Kafka Producer Connected
Order Service running on port 3000

# Once Everything is Up & Running start sending requests

curl -X POST http://localhost:3000/orders \
-H "Content-Type: application/json" \
-d '{"items":["item1","item2"]}'

