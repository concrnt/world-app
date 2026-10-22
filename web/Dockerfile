FROM nginx AS runtime
ARG VERSION

# Keep the system CA bundle current regardless of how old the nginx base image is
# (eMudhra intermediate CA compromise, 2026-10). The CI workflow excludes this stage
# from the layer cache so apt really runs on every build.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY web/dist /usr/share/nginx/html
RUN echo "{\"name\": \"github.com/concrnt/web-dashboard\", \"version\": \"${VERSION:-unknown}\"}" > /cc-info
