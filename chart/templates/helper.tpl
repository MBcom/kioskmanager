{{/*
Expand the name of the chart.
*/}}
{{- define "kioskmanager.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "kioskmanager.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "kioskmanager.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "kioskmanager.labels" -}}
helm.sh/chart: {{ include "kioskmanager.chart" . }}
{{ include "kioskmanager.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "kioskmanager.selectorLabels" -}}
app.kubernetes.io/name: {{ include "kioskmanager.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "kioskmanager.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "kioskmanager.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Helper to get the database password secret name and key.
This depends on whether the internal PostgreSQL chart is used or an external DB.
*/}}
{{- define "kioskmanager.databasePasswordSecretName" -}}
{{- if .Values.postgresql.enabled }}
{{- printf "%s-postgresql" .Release.Name }}
{{- else }}
{{- printf "%s-externaldb" (include "kioskmanager.fullname" .) }}
{{- end }}
{{- end }}

{{- define "kioskmanager.databasePasswordSecretKey" -}}
{{- if .Values.postgresql.enabled }}
{{- print "postgres-password" }}
{{- else }}
{{- print "password" }}
{{- end }}
{{- end }}