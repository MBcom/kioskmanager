# Kioskmanager

**Do you have any screens in kiosk mode, any content managers which want to display websites and videos on your kiosk screens and do you want to empower them to do it by themselfes?** Kioskmanager is the right app to do that.  

![Kiosk Manager logo](src/kioskmanager/static/img/kioskmanager.svg)



**Kioskmanager** is a web application built with Django for managing and displaying digital content (videos, websites) on multiple screens or browsers, often referred to as kiosks or digital signage displays.

It provides a central admin interface to upload content, organize it into playlists assigned to specific display groups, and manage user access. Browsers connecting to the player endpoint are automatically identified and play the content loop assigned to their group.


## Features

* **Content Management:** Upload videos and register website URLs via a web-based admin portal.
* **Website Duration:** Specify display duration for website content items.
* **Display Groups:** Create groups and assign ordered playlists of content (videos/websites) to them.
* **Browser Identification:** Player endpoints automatically identify connecting browsers using a persistent local identifier.
* **Group Assignment:** Assign identified browsers to specific Display Groups via the admin panel.
* **Looping Playback:** Player endpoint (`/play/`) automatically loops through the assigned group's playlist.
* **Role-Based Access:** Django admin with user management and permissions allowing non-superusers to manage content for specific groups.
* **Persistent Media Storage:** Uses Kubernetes Persistent Volumes to store uploaded video files.
* **Database Backend:** Utilizes PostgreSQL for storing application data.
* **Helm Deployment:** Includes a Helm chart for simplified deployment on Kubernetes.
* **Video Caching:** Nginx Ingress configuration snippet included for long-term caching of video assets.

## Prerequisites for Deployment

* Kubernetes cluster (v1.19+ recommended).
* Helm v3.0+.
* Nginx Ingress Controller installed and configured in your cluster.
* A Persistent Volume (PV) provisioner available in your cluster (required if `persistence.enabled` is true, which is the default).

## Installation using Helm

1.  **Add the Helm repo:**
    ```bash
    helm repo add kioskmanager https://mbcom.github.io/kioskmanager/
    helm repo update
    ```

2.  **Configure Values:**
    * Review and customize `values.yaml` for your environment.
    * **Crucially**, you need to set required values like the admin password (`adminPassword`), database password(s) (`postgresql.auth.password` or `externalDatabase.password`), and ingress host (`ingress.hosts[0].host`).
    * It is **strongly recommended** to manage sensitive values like passwords using `--set` flags during installation or dedicated Kubernetes secrets, rather than committing them directly to `values.yaml`.

3.  **Install the Chart:**

    * **Example using internal PostgreSQL:**
        ```bash
        helm install kioskmanager kioskmanager/kioskmanager \
          --namespace <your-namespace> \
          --create-namespace \
          --set ingress.hosts[0].host=kioskmanager.yourdomain.com \
          --set adminPassword=<your-secure-admin-password> \
          --set postgresql.auth.password=<your-secure-db-password>
        ```

    * **Example using external PostgreSQL:**
        ```bash
        helm install kioskmanager kioskmanager/kioskmanager \
          --namespace <your-namespace> \
          --create-namespace \
          --set ingress.hosts[0].host=kioskmanager.yourdomain.com \
          --set adminPassword=<your-secure-admin-password> \
          --set postgresql.enabled=false \
          --set externalDatabase.host=<your-external-db-host> \
          --set externalDatabase.username=<your-external-db-user> \
          --set externalDatabase.password=<your-secure-external-db-password> \
          --set externalDatabase.database=<your-external-db-name>
        ```

5.  **Verify Deployment:** Check the status of the pods, services, ingress, and persistent volume claims:
    ```bash
    kubectl get all -n <your-namespace>
    kubectl get pvc -n <your-namespace>
    kubectl logs deployment/<release-name>-kioskmanager -n <your-namespace> # Check application logs
    ```

## Configuration Values

The following table lists the configurable parameters of the Kioskmanager Helm chart and their default values.

| Parameter                      | Description                                                                                                | Default Value                      |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `replicaCount`                 | Number of Kioskmanager application pods.                                                                   | `1`                                |
| `image.repository`             | **Required.** Docker image repository for the Kioskmanager application.                                       | `ghcr.io/mbcom/kioskmanager` |
| `image.pullPolicy`             | Image pull policy.                                                                                         | `IfNotPresent`                     |
| `image.tag`                    | Image tag. Defaults to `.Chart.AppVersion` if not set.                                                     | `""`                               |
| `imagePullSecrets`             | List of secrets for pulling images from private registries.                                                | `[]`                               |
| `nameOverride`                 | Override the chart name component for resource names.                                                      | `""`                               |
| `fullnameOverride`             | Fully override the generated resource names.                                                               | `""`                               |
| `secretKey`                    | Django `SECRET_KEY`. If empty, a random one is generated and stored in the K8s Secret.                     | `""`                               |
| `adminUser`                    | Username for the admin user created by the startup script.                                                 | `admin`                            |
| `adminPassword`                | **Required.** Password for the admin user. Set via `--set` or values file. Stored in K8s Secret.           | `""`                               |
| `podAnnotations`               | Annotations to add to the application pods.                                                                | `{}`                               |
| `podSecurityContext`           | Security context for the application pods.                                                                 | `{}`                               |
| `securityContext`              | Security context for the application container.                                                            | `{}`                               |
| `service.type`                 | Kubernetes Service type.                                                                                   | `ClusterIP`                        |
| `service.port`                 | Port the Kubernetes Service listens on.                                                                    | `80`                               |
| `service.targetPort`           | Port the application container listens on (e.g., Gunicorn/uWSGI port). Must match app config.             | `8000`                             |
| `ingress.enabled`              | Enable Ingress resource creation. Requires an Ingress Controller (like Nginx).                              | `true`                             |
| `ingress.className`            | Ingress Class Name for the Ingress controller.                                                             | `nginx`                            |
| `ingress.annotations`          | Additional annotations for the Ingress resource (e.g., cert-manager, custom snippets).                     | See `values.yaml` for defaults     |
| `ingress.hosts`                | List of host configurations for the Ingress. **Required.** | `[{host: chart-example.local, paths: [{path: /, pathType: Prefix}]}]` |
| `ingress.hosts[].host`         | **Required.** Hostname to route traffic from.                                                              | `chart-example.local`              |
| `ingress.hosts[].paths`        | List of paths for the host.                                                                                | `[{path: /, pathType: Prefix}]`    |
| `ingress.tls`                  | TLS configuration for Ingress (list of secrets and hosts).                                                 | `[]`                               |
| `persistence.enabled`          | Enable PersistentVolumeClaim for media storage. Requires a PV provisioner.                                 | `true`                             |
| `persistence.storageClass`     | StorageClass name for the PVC. Use `"-"` for default or specify name. Leave empty to use cluster default. | `nil`                              |
| `persistence.accessModes`      | Access modes for the PVC.                                                                                  | `[ReadWriteOnce]`                  |
| `persistence.size`             | Size of the Persistent Volume for media files.                                                             | `10Gi`                             |
| `persistence.mountPath`        | Path inside the container where the media volume is mounted. Must align with Django's `MEDIA_ROOT`.       | `/app/media`                       |
| `postgresql.enabled`           | Enable deployment of the Bitnami PostgreSQL chart as a dependency.                                         | `true`                             |
| `postgresql.auth.database`     | Database name for internal PostgreSQL.                                                                     | `videolooperdb`                    |
| `postgresql.auth.username`     | Username for internal PostgreSQL.                                                                          | `videolooperuser`                  |
| `postgresql.auth.password`     | **Required if `postgresql.enabled=true`**. Password for internal PostgreSQL. Set via `--set`.                | `""`                               |
| `postgresql.*`                 | Other Bitnami PostgreSQL chart values can be nested here (e.g., `primary.persistence.enabled`).           | See Bitnami chart docs             |
| `externalDatabase.host`        | **Required if `postgresql.enabled=false`**. Hostname or IP of the external PostgreSQL server.               | `""`                               |
| `externalDatabase.port`        | Port of the external PostgreSQL server.                                                                    | `5432`                             |
| `externalDatabase.database`    | **Required if `postgresql.enabled=false`**. Database name on the external server.                         | `videolooperdb`                    |
| `externalDatabase.username`    | **Required if `postgresql.enabled=false`**. Username for the external database.                           | `videolooperuser`                  |
| `externalDatabase.password`    | **Required if `postgresql.enabled=false`**. Password for the external database. Set via `--set`.            | `""`                               |
| `resources`                    | CPU/Memory resource requests and limits for the application pods.                                          | `{}` (no defaults)                 |                          |
| `nodeSelector`                 | Node selector constraints for pod assignment.                                                              | `{}`                               |
| `tolerations`                  | Tolerations for pod assignment.                                                                            | `[]`                               |
| `affinity`                     | Affinity rules for pod assignment.                                                                         | `{}`                               |

Refer to the `values.yaml` file for detailed default annotations and structure. For parameters related to the Bitnami PostgreSQL subchart (`postgresql.*`), please consult the official [Bitnami PostgreSQL Helm Chart documentation](https://github.com/bitnami/charts/tree/main/bitnami/postgresql).
