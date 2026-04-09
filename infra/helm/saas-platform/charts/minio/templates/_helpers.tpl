{{- define "minio.name" -}}
{{- include "common.name" . }}
{{- end }}
{{- define "minio.fullname" -}}
{{- include "common.fullname" . }}
{{- end }}
{{- define "minio.labels" -}}
{{- include "common.labels" . }}
{{- end }}
{{- define "minio.selectorLabels" -}}
{{- include "common.selectorLabels" . }}
{{- end }}
