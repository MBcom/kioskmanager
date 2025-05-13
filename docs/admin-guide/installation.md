# Installation Guide (Helm)

This guide covers deploying Kioskmanager to a Kubernetes cluster using the provided Helm chart.

## Prerequisites

Ensure you have the following before proceeding:
* Kubernetes cluster (v1.19+ recommended).
* Helm v3.0+.
* `kubectl` configured to your cluster.
* Nginx Ingress Controller installed in your cluster.
* A Persistent Volume (PV) provisioner (if using persistent media storage).
* Your Kioskmanager Docker image pushed to a container registry.
* Your Kioskmanager application image meets the [requirements outlined in the main project README.md](https://github.com/<YOUR-USERNAME>/<YOUR-REPO-NAME>#application-image-requirements).

## Installation Steps
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

For a detailed list of all configurable Helm values, refer to the `README.md` in the root of the Kioskmanager project repository or the `values.yaml` file in the Helm chart.