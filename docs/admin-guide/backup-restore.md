# Backup and Restore Guide

Regular backups are essential for protecting your Kioskmanager data against accidental loss, corruption, or system failures. This guide outlines procedures for backing up and restoring the Kioskmanager database (PostgreSQL) and media files (stored on a Persistent Volume Claim).

## Overview

Kioskmanager data consists of two main parts:
1.  **Database:** Stores all configuration, content metadata, user information, display group assignments, playlists, etc. Managed by PostgreSQL.
2.  **Media Files:** Uploaded videos are stored on a Persistent Volume Claim (PVC).

Both components must be backed up and restored together to ensure data consistency.

## Restoring Database Backups

Kioskmanager has a Kubernetes CronJob Ressource by default which does daily backups and keep up to 10 of them. Please refer to Readme.md for further details. The automated backup system stores SQL dumps in a dedicated PersistentVolumeClaim. To restore a backup:

1. List available backups:
```bash
# Create a temporary pod to list backups
kubectl run list-backups --rm -i --tty \
  --image=bitnami/postgresql \
  --volumes=backup-vol:/backups \
  --overrides='{
    "spec": {
      "volumes": [{
        "name": "backup-vol",
        "persistentVolumeClaim": {"claimName": "kioskmanager-backup"}
      }]
    }
  }' \
  -- ls -l /backups
```

2. Restore a specific backup:
```bash
# Replace BACKUP_FILE with the desired backup file name from the list
kubectl run restore-backup --rm -i --tty \
  --image=bitnami/postgresql \
  --env=PGPASSWORD=$(kubectl get secret kioskmanager-postgresql -o jsonpath="{.data.password}" | base64 -d) \
  --volumes=backup-vol:/backups \
  --overrides='{
    "spec": {
      "volumes": [{
        "name": "backup-vol",
        "persistentVolumeClaim": {"claimName": "kioskmanager-backup"}
      }]
    }
  }' \
  -- psql -h kioskmanager-postgresql \
         -U taskkioskmanagerpostgres \
         -d dbkioskmanager \
         -f /backups/BACKUP_FILE
```

> **Note**: Replace `kioskmanager-backup`, `kioskmanager-postgresql`, and other values according to your release name and configuration.

### Important Considerations

- The restore process will overwrite existing database content
- Ensure no active writes are happening during restore
- Consider scaling down the application during restore:
  ```bash
  kubectl scale deployment kioskmanager --replicas=0
  # ... perform restore ...
  kubectl scale deployment kioskmanager --replicas=1
  ```
- Match the backup with the corresponding media files backup to maintain consistency