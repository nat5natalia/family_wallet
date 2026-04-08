# ========== BUILD STAGE ==========
FROM maven:3.9-eclipse-temurin-17-alpine AS builder

WORKDIR /app

# Копируем только pom.xml для кеширования зависимостей
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Копируем исходный код и собираем проект
COPY src src
RUN mvn clean package -DskipTests

# ========== RUNTIME STAGE ==========
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Копируем собранный JAR из builder стадии
COPY --from=builder /app/target/*.jar app.jar

EXPOSE 8081

HEALTHCHECK --interval=15s --timeout=10s --retries=5 \
  CMD wget -qO- http://localhost:8081/actuator/health || exit 1

ENTRYPOINT ["java", "-jar", "app.jar"]
