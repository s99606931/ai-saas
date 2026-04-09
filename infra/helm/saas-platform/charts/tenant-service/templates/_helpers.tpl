{{- define "tenant-service.name" -}}
{{- include "common.name" . }}
{{- end }}
{{- define "tenant-service.fullname" -}}
{{- include "common.fullname" . }}
{{- end }}
{{- define "tenant-service.labels" -}}
{{- include "common.labels" . }}
{{- end }}
{{- define "tenant-service.selectorLabels" -}}
{{- include "common.selectorLabels" . }}
{{- end }}
