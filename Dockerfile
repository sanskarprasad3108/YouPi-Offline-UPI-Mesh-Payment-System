# Multi-stage build for lightweight, fast deployment
# build: v3 - cache-bust forced recompile of all sources
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app
# Copy everything together so any source change invalidates the compile layer
COPY pom.xml .
COPY src ./src
# Force a completely clean build — no incremental caching
RUN mvn clean package -DskipTests --no-transfer-progress

# Run stage
FROM eclipse-temurin:17-jre-jammy
WORKDIR /app
COPY --from=build /app/target/upi-offline-mesh-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8080
ENV PORT=8080
ENTRYPOINT ["sh", "-c", "java -Dserver.port=${PORT:-8080} -jar app.jar"]
