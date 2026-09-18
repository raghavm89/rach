-- The port the container listens on (the app's HTTP port). NULL → the platform default 8080.
-- Threaded to the App CRD → the Deployment containerPort + the Service port/targetPort, so the
-- workload is reachable for apps that don't listen on 8080.

ALTER TABLE services ADD COLUMN IF NOT EXISTS port INTEGER;
