FROM nginx
ARG VERSION

COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY web/dist /usr/share/nginx/html
RUN echo "{\"name\": \"github.com/concrnt/web-dashboard\", \"version\": \"${VERSION:-unknown}\"}" > /cc-info
