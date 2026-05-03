# Используем такой же образ, как для бэкенда (Debian-based, без проблем с бинарниками)
FROM node:18-slim AS build

WORKDIR /app

# Копируем package.json и устанавливаем зависимости
COPY package*.json ./
RUN npm install

# Копируем исходный код
COPY . .

# Очищаем кэш Angular (опционально)
RUN rm -rf .angular/cache

# Собираем проект, вызывая ng.js напрямую (как делали с tsc)
RUN node node_modules/@angular/cli/bin/ng.js build

# Финальный образ для раздачи статики
FROM node:18-slim

WORKDIR /app

# Устанавливаем простой сервер
RUN npm install -g http-server

# Копируем собранные файлы из первого этапа
# Убедитесь, что путь dist/lms-frontend совпадает с вашим outputPath в angular.json
COPY --from=build /app/dist/lms-frontend ./dist

EXPOSE 8080

CMD ["http-server", "dist", "-p", "8080", "-a", "0.0.0.0", "--cors"]